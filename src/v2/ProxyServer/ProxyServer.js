const Socks = require('socks');
const http = require('http');
const net = require('net');
const { register } = require('prom-client');
const { Server } = require('http');
const { Resolver } = require('dns').promises;
const { DNSError } = require('../errors');
const { create_cn_net_matcher, create_internal_net_matcher } = require('../NetMatcher');
const { TheGFWListMatcher } = require('../AdblockList');
const { createLogger } = require('../Logger');
const {
  request_total,
  connect_total,
  direct_check_total,
  dns_query_timeout_total,
  client_total,
} = require('../Metrics');
const { runOnceWrapper } = require('../Utils');


class ProxyServer extends Server {

  constructor(options = {}) {
    super();
    this._options = options;
    this._logger = createLogger('ProxyServer');
    this._resolver = new Resolver();
    this._logger.info(`DNS servers: ${options.dns}`);
    this._resolver.setServers(options.dns.split(','));
    this._cn_net_matcher = create_cn_net_matcher(this._resolver);
    this._internal_net_matcher = create_internal_net_matcher(this._resolver);
    this._socks_server = new URL(options.socks);
    this._direct_check_cache = new Map();
    this._clients = new Set();
    this.on('request', this.onRequest);
    this.on('connect', this.onConnect);
  }

  /**
   * check an uri is direct access by this proxy, or use the socks proxy to process
   * 
   * cached with hostname (ignore query & path)
   * 
   * @param {string} urlOrHostname 
   */
  async isDirectAccess(urlOrHostname = '') {

    let direct = true;
    let url = urlOrHostname;
    if (!url.startsWith('http')) {
      url = `https://${url}`; // gfwlist need use a full uri pattern (with schema)
    }

    const { hostname } = new URL(url); // extract hostname

    if (!this._direct_check_cache.has(hostname)) {

      try {

        // internal check
        if (await this._internal_net_matcher.hostname_in_net(hostname)) {
          this._logger.info(`ip matched (internal): ${url}, direct`);
          direct = true;
        }
        // gfw check
        else if (await TheGFWListMatcher.match(url)) {
          this._logger.info(`gfw matched: ${url}, proxy`);
          direct = false;
        }
        // cn net check
        else if (!await this._cn_net_matcher.hostname_in_net(hostname)) {
          this._logger.info(`ip matched: ${url}, proxy`);
          direct = false;
        }
        // fallback
        else {
          this._logger.info(`not matched: ${url}, direct`);
        }

      } catch (err) {
        if (err instanceof DNSError) {
          dns_query_timeout_total.inc();
          this._logger.error(`dns-lookup '${hostname}' failed: ${err.message}`);
          direct = true;
        } else {
          this._logger.error(`match rule for '${urlOrHostname}' failed: ${err.message}`);
          direct = true;
        }
      }

      this._direct_check_cache.set(hostname, direct); // cache it
      direct_check_total.labels(hostname, false).inc();
    } else {
      direct_check_total.labels(hostname, true).inc();
    }

    return this._direct_check_cache.get(hostname);
  }

  /**
   * add client to this proxy, just for metric
   * 
   * @param {import("http").IncomingMessage} request 
   */
  _addClient(remoteAddress) {
    if (!this._clients.has(remoteAddress)) {
      client_total.inc();
      this._clients.add(remoteAddress);
    }
  }

  _getProxyConfiguration() {
    return {
      ipaddress: this._socks_server.hostname,
      port: parseInt(this._socks_server.port, 10),
      type: 5, // TODO: update version by uri schema
      authentication: {
        username: this._socks_server.username || '',
        password: this._socks_server.password || ''
      },
    };
  }

  /**
   * prometheus metric
   * 
   * @param {import("http").ServerResponse} response 
   */
  _metric_endpoint(request, response) {

    response.setHeader('Content-Type', register.contentType);
    response.end(register.metrics());

  }

  /**
   * on http request inbound
   * 
   * @param {import("http").IncomingMessage} request 
   * @param {import("http").ServerResponse} response 
   */
  async onRequest(request, response) {

    this._addClient(request.connection.remoteAddress);

    // metric
    if (request.url == '/http-socks/__/metric') {
      this._metric_endpoint(request, response);
      return;
    }

    // access from localhost, return 404
    if (request.url.startsWith('/')) {
      response.statusCode = 404;
      response.end();
      return;
    }

    const uri = new URL(request.url);

    const metric = request_total.labels(uri.hostname, false);

    const error_metric = request_total.labels(uri.hostname, true);

    const log_error = runOnceWrapper((...args) => this._logger.error(...args), () => error_metric.inc());

    metric.inc();

    const agentOpt = {
      proxy: this._getProxyConfiguration(),
      target: { host: uri.hostname, port: uri.port },
    };

    const direct = await this.isDirectAccess(request.url);

    const options = {
      port: uri.port,
      hostname: uri.hostname, // only hostname ip, no port
      method: request.method,
      path: uri.pathname,
      headers: request.headers,
    };

    if (!direct) {
      this._logger.debug(`proxy-request: ${request.url}`);
      options.agent = new Socks.Agent(agentOpt);
    } else {
      this._logger.debug(`direct-request: ${request.url}`);
    }

    const proxyRequest = http.request(options);

    request.on('error', (err) => {
      log_error(`${err.message}`);
      proxyRequest.destroy(err);
    });

    proxyRequest.on('error', (error) => {
      log_error(`${error.message} on proxy ${uri.host}`);
      response.writeHead(500);
      response.end('Connection error\n');
    });

    proxyRequest.on('response', (proxyResponse) => {
      proxyResponse.pipe(response);
      response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    });

    request.pipe(proxyRequest);
  }

  /**
   * on http CONNECT method
   * 
   * @param {import("http").IncomingMessage} request 
   * @param {import("stream").Duplex} socketRequest 
   * @param {Buffer} head 
   */
  async onConnect(request, socketRequest, head) {


    this._addClient(request.connection.remoteAddress);

    const proxy = this._getProxyConfiguration();

    const uri = new URL(`http://${request.url}`);

    const { hostname: host, port } = uri;

    const metric = connect_total.labels(host, false);
    const error_metric = connect_total.labels(host, true);
    const socketTimeout = this._options.timeout || 120 * 1000;

    const log_error = runOnceWrapper((...args) => this._logger.error(...args), () => error_metric.inc());

    metric.inc();

    /**
     * @type {import("stream").Duplex}
     */
    let socket;

    socketRequest.on('error', (err) => {
      log_error(`client error for ${request.url}: '${err.message}'`);
      if (socket) {
        socket.destroy(err);
      }
    });

    socketRequest.on('end', () => {
      this._logger.debug(`client socket for ${request.url}: ended`);
      if (socket && !socket.destroyed) {
        socket.end();
      }
    });

    const onRemoteSocketEnd = () => {
      this._logger.debug(`socket for ${request.url}: ended`);
      if (!socketRequest.destroyed) {
        socketRequest.end();
      }
    };

    const onRemoteSocketError = (err) => {
      log_error(`socket error for ${request.url}: '${err.message}'`);
      socketRequest.destroy(err);
    };

    const direct = await this.isDirectAccess(request.url);

    if (!direct) {

      this._logger.debug(`proxy-connect: ${request.url}`);

      Socks.createConnection({
        proxy, target: { host, port }, command: 'connect', timeout: socketTimeout
      }, (error, _socket) => {
        socket = _socket;

        if (error) {
          // error in SocksSocket creation
          log_error(`${error.message} connection creating on ${proxy.ipaddress}:${proxy.port}`);
          socketRequest.write(`HTTP/${request.httpVersion} 500 Connection error\r\n\r\n`);
          return;
        }

        socket.on('error', onRemoteSocketError);

        socket.on('end', onRemoteSocketEnd);

        // tunneling to the host
        socket.pipe(socketRequest);
        socketRequest.pipe(socket);

        socket.write(head);
        socketRequest.write(`HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`);
        socket.resume();

      });

    } else {

      this._logger.debug(`direct-connect: ${request.url}`);

      socket = net.connect({ port: uri.port, host: uri.hostname, timeout: socketTimeout }, () => {

        socketRequest.write('HTTP/1.1 200 Connection established\r\n\r\n');
        socket.write(head);
        socketRequest.pipe(socket);
        socket.pipe(socketRequest);

      });

      socket.on('error', onRemoteSocketError);

      socket.on('end', onRemoteSocketEnd);

    }

  }

}

module.exports = { ProxyServer };