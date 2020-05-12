// inspired by https://github.com/asluchevskiy/http-to-socks-proxy
const util = require('util');
const url = require('url');
const http = require('http');
const net = require('net');
const fs = require('fs');
const Socks = require('socks');
const { resolver } = require('./dns');
const { logger } = require('./logger');
const { get_gfw_list_matcher } = require('./gfwlist');
const { get_internal_net_matcher, get_cn_net_matcher } = require('./net');

const SOCKET_TIMEOUT = 120 * 1000; // 120 seconds

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getProxyObject(host, port, login, password) {
  return {
    ipaddress: host,
    port: parseInt(port, 10),
    type: 5,
    authentication: { username: login || '', password: password || '' },
  };
}

async function is_direct_access(url_or_hostname = '') {

  const matcher = await get_gfw_list_matcher();
  const net_matcher = get_cn_net_matcher(resolver);
  const internal_net_matcher = get_internal_net_matcher(resolver);
  let direct = true;
  let url = url_or_hostname;
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  const { hostname } = new URL(url);

  if (matcher(url)) {
    logger.info(`gfw matched: ${url}, proxy`);
    direct = false;
  } else if (await internal_net_matcher.hostname_in_net(hostname)) {
    logger.info(`ip matched (internal): ${url}, direct`);
    direct = true;
  } else if (!await net_matcher.hostname_in_net(hostname)) {
    logger.info(`ip matched: ${url}, proxy`);
    direct = false;
  } else {
    logger.info(`not matched: ${url}, direct`);
  }

  return direct;

}

function parseProxyLine(line) {
  const proxyInfo = line.split(':');

  if (proxyInfo.length !== 4 && proxyInfo.length !== 2) {
    throw new Error(`Incorrect proxy line: ${line}`);
  }

  return getProxyObject.apply(this, proxyInfo);
}

async function requestListener(getProxyInfo, request, response) {

  const proxy = getProxyInfo();
  const ph = url.parse(request.url);
  const agentOpt = {
    proxy,
    target: { host: ph.hostname, port: ph.port },
  };

  const direct = await is_direct_access(request.url);

  const options = {
    port: ph.port,
    hostname: ph.hostname,
    method: request.method,
    path: ph.path,
    headers: request.headers,
  };

  if (!direct) {
    logger.debug(`proxy-request: ${request.url}`);
    options.agent = new Socks.Agent(agentOpt);
  } else {
    logger.debug(`direct-request: ${request.url}`);
  }

  const proxyRequest = http.request(options);

  request.on('error', (err) => {
    logger.error(`${err.message}`);
    proxyRequest.destroy(err);
  });

  proxyRequest.on('error', (error) => {
    logger.error(`${error.message} on proxy ${proxy.ipaddress}:${proxy.port}`);
    response.writeHead(500);
    response.end('Connection error\n');
  });

  proxyRequest.on('response', (proxyResponse) => {
    proxyResponse.pipe(response);
    response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
  });

  request.pipe(proxyRequest);
}

async function connectListener(getProxyInfo, request, socketRequest, head) {

  const proxy = getProxyInfo();

  const ph = url.parse(`http://${request.url}`);
  const { hostname: host, port } = ph;

  const options = {
    proxy,
    target: { host, port },
    command: 'connect',
    timeout: SOCKET_TIMEOUT
  };

  let socket;

  socketRequest.on('error', (err) => {
    logger.error(`client error for ${request.url}: '${err.message}'`);
    if (socket) {
      socket.destroy(err);
    }
  });

  socketRequest.on('end', () => {
    logger.debug(`client socket for ${request.url}: ended`);
    if (socket && !socket.destroyed) {
      socket.end();
    }
  });

  const direct = await is_direct_access(request.url);

  if (!direct) {

    logger.debug(`proxy-connect: ${request.url}`);

    Socks.createConnection(options, (error, _socket) => {
      socket = _socket;

      if (error) {
        // error in SocksSocket creation
        logger.error(`${error.message} connection creating on ${proxy.ipaddress}:${proxy.port}`);
        socketRequest.write(`HTTP/${request.httpVersion} 500 Connection error\r\n\r\n`);
        return;
      }

      socket.on('error', (err) => {
        logger.error(`socket error for ${request.url}: '${err.message}'`);
        socketRequest.destroy(err);
      });

      socket.on('end', () => {
        logger.debug(`socket for ${request.url}: ended`);
        if (!socketRequest.destroyed) {
          socketRequest.end();
        }
      });

      // tunneling to the host
      socket.pipe(socketRequest);
      socketRequest.pipe(socket);

      socket.write(head);
      socketRequest.write(`HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`);
      socket.resume();

    });

  } else {

    logger.debug(`direct-connect: ${request.url}`);

    socket = net.connect({
      port: ph.port, host: ph.hostname, timeout: SOCKET_TIMEOUT
    }, () => {

      socketRequest.write('HTTP/1.1 200 OK\r\n\r\n');
      socketRequest.pipe(socket);
      socket.pipe(socketRequest);

    });

    socket.on('error', (err) => {
      logger.error(`socket error for ${request.url}: '${err.message}'`);
      socketRequest.destroy(err);
    });

    socket.on('end', () => {
      logger.debug(`socket for ${request.url}: ended`);
      if (!socketRequest.destroyed) {
        socketRequest.end();
      }
    });

  }


}

function ProxyServer(options) {
  http.Server.call(this, () => { });

  logger.info(`DNS servers: ${options.dns}`);
  resolver.setServers(options.dns.split(','));

  this.proxyList = [];

  if (options.socks) {
    // stand alone proxy loging
    this.loadProxy(options.socks);
  } else if (options.socksList) {
    // proxy list loading
    this.loadProxyFile(options.socksList);
    if (options.proxyListReloadTimeout) {
      setInterval(
        () => {
          this.loadProxyFile(options.socksList);
        },
        options.proxyListReloadTimeout * 1000
      );
    }
  }

  this.addListener(
    'request',
    requestListener.bind(null, () => randomElement(this.proxyList))
  );

  this.addListener(
    'connect',
    connectListener.bind(null, () => randomElement(this.proxyList))
  );

}

util.inherits(ProxyServer, http.Server);

ProxyServer.prototype.loadProxy = function loadProxy(proxyLine) {
  try {
    this.proxyList.push(parseProxyLine(proxyLine));
  } catch (ex) {
    logger.error(ex.message);
  }
};

ProxyServer.prototype.loadProxyFile = function loadProxyFile(fileName) {
  const self = this;

  logger.info(`Loading proxy list from file: ${fileName}`);

  fs.readFile(fileName, (err, data) => {
    if (err) {
      logger.error(
        `Impossible to read the proxy file : ${fileName} error : ${err.message}`
      );
      return;
    }

    const lines = data.toString().split('\n');
    const proxyList = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (!(lines[i] !== '' && lines[i].charAt(0) !== '#')) {
        try {
          proxyList.push(parseProxyLine(lines[i]));
        } catch (ex) {
          logger.error(ex.message);
        }
      }
    }
    self.proxyList = proxyList;
  });
};

ProxyServer.prototype.destroy = async () => {
};

module.exports = {
  createServer: (options) => new ProxyServer(options),
  requestListener,
  connectListener,
  getProxyObject,
  parseProxyLine,
};
