// inspired by https://github.com/asluchevskiy/http-to-socks-proxy
const util = require('util');
const url = require('url');
const http = require('http');
const net = require("net");
const fs = require('fs');
const Socks = require('socks');
const { logger } = require('./logger');
const { get_agent } = require("./agents_cache");
const { default_cn_net_matcher } = require("./net");

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

function parseProxyLine(line) {
  const proxyInfo = line.split(':');

  if (proxyInfo.length !== 4 && proxyInfo.length !== 2) {
    throw new Error(`Incorrect proxy line: ${line}`);
  }

  return getProxyObject.apply(this, proxyInfo);
}

async function requestListener(getProxyInfo, request, response) {

  logger.info(`request: ${request.url}`);

  const proxy = getProxyInfo();
  const ph = url.parse(request.url);

  const socksAgent = get_agent({
    proxy,
    target: { host: ph.hostname, port: ph.port },
  });

  const options = {
    port: ph.port,
    hostname: ph.hostname,
    method: request.method,
    path: ph.path,
    headers: request.headers,
  };

  if (!await default_cn_net_matcher.hostname_in_net(ph.hostname)) {
    logger.info(`proxy: ${request.url}`);
    options.agent = socksAgent;
  } else {
    logger.info(`direct: ${request.url}`);
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
  };

  let socket;

  socketRequest.on('error', (err) => {
    logger.error(`${err.message}`);
    if (socket) {
      socket.destroy(err);
    }
  });

  if (!await default_cn_net_matcher.hostname_in_net(ph.hostname)) {
    logger.info(`proxy-connect: ${request.url}`);

    Socks.createConnection(options, (error, _socket) => {
      socket = _socket;

      if (error) {
        // error in SocksSocket creation
        logger.error(`${error.message} connection creating on ${proxy.ipaddress}:${proxy.port}`);
        socketRequest.write(`HTTP/${request.httpVersion} 500 Connection error\r\n\r\n`);
        return;
      }

      socket.on('error', (err) => {
        logger.error(`${err.message}`);
        socketRequest.destroy(err);
      });

      // tunneling to the host
      socket.pipe(socketRequest);
      socketRequest.pipe(socket);

      socket.write(head);
      socketRequest.write(`HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`);
      socket.resume();

    });
  } else {
    logger.info(`direct-connect: ${request.url}`);

    socket = net.connect(ph.port, ph.hostname, () => {

      socketRequest.write("HTTP/1.1 200 OK\r\n\r\n");
      socketRequest.pipe(socket);
      socket.pipe(socketRequest);

    });

    socket.on('error', (err) => {
      logger.error(`${err.message}`);
      socketRequest.destroy(err);
    });

  }


}

function ProxyServer(options) {
  // TODO: start point
  http.Server.call(this, () => { });

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

module.exports = {
  createServer: (options) => new ProxyServer(options),
  requestListener,
  connectListener,
  getProxyObject,
  parseProxyLine,
};
