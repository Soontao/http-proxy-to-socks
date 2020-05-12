const { readFile } = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');
const { Filter } = require('adblockpluscore/lib/filterClasses');
const { contentTypes, filterEngine } = require('adblockpluscore');
const { memoize } = require('lodash');

/**
 * 
 * @param {string} text
 * @returns {array} 
 */
const parse_adblock_filter = text => {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.startsWith('!'))
    .filter(line => !(line.startsWith('[') && line.endsWith(']')))
    .map(Filter.fromText);
  return lines;
};

let instance = null;

/**
 * please do NOT clear the filterEngine
 * 
 * @returns {Promise<(url:string)=>boolean>} matcher function
 */
const get_gfw_list_matcher = async () => {
  if (instance == null) {
    const rawText = await readFile(path.join(__dirname, './resources/gfwlist.raw.txt'), { encoding: 'UTF-8' });
    const text = Buffer.from(rawText, 'base64').toString('UTF-8');
    await filterEngine.initialize([]);
    parse_adblock_filter(text).forEach(filterEngine.add);
    instance = memoize(url => {
      const start_time = process.hrtime();
      const r = filterEngine.match(url, contentTypes.OTHER);
      const end_time = process.hrtime(start_time);
      logger.debug(`gfw-query: ${url} - ${end_time[1] / 1000000}ms`);
      return r;
    });
  }
  return instance;
};

module.exports = {
  parse_adblock_filter,
  get_gfw_list_matcher,
};