const log4js = require('log4js');
const { pid } = require('process');

function createLogger(level = process.env.LOGGER_LEVEL || 'info') {
  const logger = log4js.getLogger(`${pid}`);
  logger.level = level;
  return logger;
}

function changeLevel(logger, level) {
  logger.level = level;
}

const logger = createLogger();

module.exports = {
  logger,
  createLogger,
  changeLevel,
};
