const { Netmask } = require('netmask');
const { map, some } = require('lodash');
const dns = require('dns').promises;
const cn_net_masks = require("./net_cn_ip_list");
const { logger } = require("./logger");

class NetMatcher {
  constructor(masks = []) {
    this._masks = map(masks, (m) => new Netmask(m));
  }

  add_subnet(mask) {
    this._masks.push(mask);
  }

  ip_in_net(ip = '') {
    return some(this._masks, (m) => m.contains(ip));
  }

  async hostname_in_net(hostname = '') {
    try {
      const ips = await dns.resolve4(hostname);
      if (ips) {
        return some(this._masks, (m) => some(ips, (ip) => m.contains(ip)));
      }
    } catch (err) {
      logger.error(`dns lookup '${hostname}' failed`);
      logger.error(err);
    }

    return false;
  }
}

const default_cn_net_matcher = new NetMatcher(cn_net_masks);


module.exports = { NetMatcher, default_cn_net_matcher };
