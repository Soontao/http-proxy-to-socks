const { map, some, memoize } = require('lodash');
const { Resolver } = require('dns').promises;
const cn_net_masks = require('./net_cn_ip_list');
const { logger } = require('./logger');
const workerpool = require('workerpool');
const numCPUs = require('os').cpus().length;
const is_ip = require('is-ip');

const ip_in_nets = async (ip = '', nets_mask = []) => {
  const { map, some } = require('lodash');
  const { Netmask } = require('netmask');
  return some(map(nets_mask, m => new Netmask(m)), m => m.contains(ip));
};

const timeout = (mSec = 1000, message = 'timeout') => {
  return new Promise((resolve, reject) => {
    setTimeout(() => { reject(new Error(message)); }, mSec);
  });
};

class NetMatcher {

  constructor(masks = [], resolver = new Resolver()) {

    this._masks = masks;
    this._in_memory_dns_cache = new Map();
    this._in_memory_ip_match_cache = new Map();
    this._resolver = resolver;
    this._pool = workerpool.pool({
      minWorkers: 1,
      maxWorkers: numCPUs * 2,
      workerType: 'thread'
    });

  }

  add_subnet(mask) {
    this._masks.push(mask);
  }

  async ip_in_net(ip = '') {
    return await this._pool.exec(ip_in_nets, [ip, this._masks]);
  }

  async cached_ip_in_net(ip = '') {
    if (!this._in_memory_ip_match_cache.has(ip)) {
      this._in_memory_ip_match_cache.set(ip, await this.ip_in_net(ip));
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
      const ips = await Promise.race([
        this._resolver.resolve4(hostname), // query dns
        timeout(1 * 1000, 'dns query timeout') // query timeout
      ]);
      this._in_memory_dns_cache.set(hostname, ips);
    }
    return this._in_memory_dns_cache.get(hostname);

  }

  async hostname_in_net(hostname = '') {
    if (is_ip(hostname)) {
      return await this.cached_ip_in_net(hostname);
    }

    try {
      const start_time = process.hrtime();
      const ips = await this.cached_resolve(hostname);
      const end_time = process.hrtime(start_time);
      logger.debug(`dns-query: ${hostname} - ${end_time[1] / 1000000}ms`);
      if (ips) {
        return some(await Promise.all(map(ips, ip => this.cached_ip_in_net(ip))));
      }
    } catch (err) {
      logger.error(`dns-lookup '${hostname}' failed: ${err.message}`);
    }

    return false;
  }

  async destroy() {
    await this._pool.terminate(true, 1000);
    delete this._pool;
    this._pool = {
      exec: () => { throw new Error('this NetMatcher instance has been destroyed'); }
    };
  }
}

const create_cn_net_matcher = (resolver) => {
  return new NetMatcher(cn_net_masks, resolver);
};

const create_internal_net_matcher = (resolver) => {
  const private_network_mask = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
  ];
  return new NetMatcher(private_network_mask, resolver);
};

const get_cn_net_matcher = memoize(create_cn_net_matcher);

const get_internal_net_matcher = memoize(create_internal_net_matcher);

module.exports = {
  NetMatcher,
  create_cn_net_matcher,
  get_internal_net_matcher,
  get_cn_net_matcher
};
