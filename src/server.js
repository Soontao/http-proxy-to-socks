const { logger, changeLevel } = require('./logger');
const { createServer: createProxyServer } = require('./proxy_server');


function createServer(options, cb) {

  if (typeof options.level === 'string') {
    changeLevel(logger, options.level);
  }

  const { port, host } = options;

  return createProxyServer(options).listen(port, host, cb);

}

module.exports = {
  createServer,
};
