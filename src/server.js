const { ProxyServer } = require('./v2');

function createServer(options, cb) {

  const { port, host } = options;
  const server = new ProxyServer(options);
  return server.listen(port, host, cb);

}

module.exports = {
  createServer,
};
