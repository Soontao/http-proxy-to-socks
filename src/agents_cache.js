
const Socks = require('socks');

const cache = new Map();

/**
 * get agent with cache
 * @param {any} opt 
 * @returns {Socks.Agent}
 */
const get_agent = (opt) => {
  const k = JSON.stringify(opt);
  if (!cache.has(k)) {
    cache.set(k, new Socks.Agent(opt));
  }
  return cache.get(k);
};

module.exports = { get_agent };