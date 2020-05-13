const { getLogger } = require('log4js');

/**
 * create new logger instance
 * 
 * @param {string} category 
 */
const createLogger = (category) => {
  const newLogger = getLogger(category);
  newLogger.level = process.env.LOGGER_LEVEL || 'info';
  return newLogger;
};

module.exports = { createLogger };