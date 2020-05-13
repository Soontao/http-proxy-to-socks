const { readFileSync } = require('fs');
const { resolve } = require('path');
const cli = require('commander');
const { version } = require('../package.json');
const { createServer } = require('./server');
const { logger } = require('./logger');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const optionNames = [
  'socks',
  'port',
  'level',
  'config',
  'host',
  'dns',
];

const DEFAULT_OPTIONS = {
  host: '0.0.0.0',
  socks: 'socks5://127.0.0.1:1080',
  proxyListReloadTimeout: 60,
  port: 18080,
  dns: ['127.0.0.1', '114.114.114.114'].join(',')
};

function getFileConfig(filePath) {

  const absFile = resolve(process.cwd(), filePath);

  const content = readFileSync(absFile).toString('utf8');

  let fileConfig = null;

  try {
    fileConfig = JSON.parse(content);
  } catch (err) {
    const error = new Error(`invalid json content: ${err.message}`);
    error.code = err.code;
    throw error;
  }

  return fileConfig;
}

function getOptionsArgs(args) {
  const options = {};

  optionNames.forEach((name) => {
    if (Object.hasOwnProperty.apply(args, [name])) {
      if (typeof args[name] !== 'string') {
        throw new Error(`string "${name}" expected`);
      }
      options[name] = args[name];
    }
  });

  return options;
}

function main() {

  cli.version(version)
    .option('-s, --socks [socks]', 'specify your socks proxy host, default: 127.0.0.1:1080')
    .option('-p, --port [port]', 'specify the listening port of http proxy server, default: 8080')
    .option('-l, --host [host]', 'specify the listening host of http proxy server, default: 127.0.0.1')
    .option('-c, --config [config]', 'read configs from file in json format')
    .option('-d, --dns [dns]', 'dns servers')
    .option('--level [level]', 'log level, vals: info, error')
    .parse(process.argv);

  const arg_options = getOptionsArgs(cli);

  let fileConfig = null;

  if (arg_options.config) {
    fileConfig = getFileConfig(arg_options.config);
  }


  const options = Object.assign(DEFAULT_OPTIONS, arg_options, fileConfig);

  if (process.env.ENABLE_CLUSTER) {
    run_cluster_mode(options);
  } else {
    run(options);
  }

}

const run = (options) => {

  const { port, host, socks } = options;

  logger.info('HTTP to SOCKS proxy (normal)');
  logger.info(`SOCKS server: ${socks}`);
  logger.info(`HTTP proxy: ${host}:${port}`);


  createServer(options, () => {
    logger.info(`HPTS ${process.pid} started.`);
  });

};

const run_cluster_mode = (options) => {

  const process_number = parseInt(process.env.PROCESS_NUM || `${numCPUs}`);

  const { port, host, socks } = options;

  if (cluster.isMaster) {

    logger.info('HTTP to SOCKS proxy (cluster)');
    logger.info(`SOCKS server: ${socks}`);
    logger.info(`HTTP proxy: ${host}:${port}`);

    // Fork workers.
    for (let i = 0; i < process_number; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker) => {
      logger.error(`worker ${worker.process.pid} died, restart it.`);
      setTimeout(() => { cluster.fork(); }, 0);
    });

  } else {

    createServer(options, () => {
      logger.info(`Worker ${process.pid} started.`);
    });

  }

};

module.exports = {
  getOptionsArgs,
  main,
};
