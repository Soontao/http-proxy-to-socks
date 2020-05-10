const { logger, changeLevel } = require('./logger');
const { createServer: createProxyServer } = require('./proxy_server');

const DEFAULT_OPTIONS = {
  host: '127.0.0.1',
  socks: '127.0.0.1:1080',
  proxyListReloadTimeout: 60,
  port: 8080,
};

function createServer(opts, cb) {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  if (typeof options.level === 'string') {
    changeLevel(logger, options.level);
  }

  const { port, host } = options;

  return createProxyServer(options).listen(port, host, cb);
}

module.exports = {
  createServer,
};
