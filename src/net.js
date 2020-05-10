const { Netmask } = require('netmask');
const { map, some } = require('lodash');
const dns = require('dns').promises;
const cn_net_masks = require('./net_cn_ip_list');
const { logger } = require('./logger');

class NetMatcher {

  constructor(masks = []) {
    this._masks = map(masks, (m) => new Netmask(m));
    this._in_memory_dns_cache = new Map();
    this._in_memory_ip_match_cache = new Map();
  }

  add_subnet(mask) {
    this._masks.push(mask);
  }

  ip_in_net(ip = '') {
    return some(this._masks, (m) => m.contains(ip));
  }

  cached_ip_in_net(ip = '') {
    if (!this._in_memory_ip_match_cache.has(ip)) {
      this._in_memory_ip_match_cache.set(ip, this.ip_in_net(ip));
    }

    return this._in_memory_ip_match_cache.get(ip);
  }

  /**
   * dns query with cache
   * 
   * this is possible because the service provider can not move the data center so quickly.
   * 
   * @param {string} hostname 
   */
  async cached_resolve(hostname = '') {

    if (!this._in_memory_dns_cache.has(hostname)) {
      const ips = await dns.resolve4(hostname);
      this._in_memory_dns_cache.set(hostname, ips);
    }
    return this._in_memory_dns_cache.get(hostname);

  }

  async hostname_in_net(hostname = '') {

    try {
      const start_time = process.hrtime();
      const ips = await this.cached_resolve(hostname);
      const end_time = process.hrtime(start_time);
      logger.debug(`dns-query: ${hostname} - ${end_time[1] / 1000000}ms`);
      if (ips) {
        return some(ips, (ip) => this.cached_ip_in_net(ip));
      }
    } catch (err) {
      logger.error(`dns-lookup '${hostname}' failed: ${err.message}`);
    }

    return false;
  }
}

const default_cn_net_matcher = new NetMatcher(cn_net_masks);


module.exports = { NetMatcher, default_cn_net_matcher };
