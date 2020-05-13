const { readFile } = require('fs').promises;
const path = require('path');
const { Filter } = require('adblockpluscore/lib/filterClasses');
const { contentTypes, filterEngine } = require('adblockpluscore');
const { createLogger } = require('../../Logger');

/**
 * 
 * @param {string} text
 * @returns {array} 
 */
const parseAdblockFilter = text => {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.startsWith('!'))
    .filter(line => !(line.startsWith('[') && line.endsWith(']')))
    .map(Filter.fromText);
  return lines;
};


/**
 * please do NOT clear the filterEngine
 * 
 * must singleton, because limited by the adblock framework
 * 
 */
class GFWListMatcher {

  constructor() {
    this._initialized = false;
    this._logger = createLogger('GFWListMatcher');
  }

  async _initialize() {
    const rawText = await readFile(
      path.join(__dirname, '../../../resources/gfwlist.raw.txt'),
      { encoding: 'UTF-8' }
    );
    const text = Buffer.from(rawText, 'base64').toString('UTF-8');
    await filterEngine.initialize([]);
    parseAdblockFilter(text).forEach(filterEngine.add);
    this._initialized = true;
  }

  async match(uri = '') {
    if (!this._initialized) {
      await this._initialize();
    }
    const start_time = process.hrtime();
    const r = filterEngine.match(uri, contentTypes.OTHER);
    const end_time = process.hrtime(start_time);
    this._logger.debug(`gfw-query: ${uri} - ${end_time[1] / 1000000}ms`);
    return r;
  }

}

const TheGFWListMatcher = new GFWListMatcher();

module.exports = {
  TheGFWListMatcher
};