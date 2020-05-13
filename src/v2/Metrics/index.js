const { Counter } = require('prom-client');

const metrics = {
  direct_check_total: new Counter({
    name: 'direct_check_total',
    help: 'direct check total',
    labelNames: ['remote', 'cached'],
  }),
  request_total: new Counter({
    name: 'request_total',
    help: 'http request total',
    labelNames: ['remote', 'error']
  }),
  connect_total: new Counter({
    name: 'connect_total',
    help: 'http connect total',
    labelNames: ['remote', 'error']
  }),
  dns_query_total: new Counter({
    name: 'dns_query_total',
    help: 'dns query total',
    labelNames: ['remote', 'cached'],
  }),
  dns_query_time_ms_total: new Counter({ name: 'dns_query_time_ms_total', help: 'dns query time (ms)' }),
  dns_query_timeout_total: new Counter({ name: 'dns_query_timeout_total', help: 'dns query timeout total' }),
  ip_determine_total: new Counter({
    name: 'ip_determine_total', help: 'ip determine total'
  }),
  client_total: new Counter({
    name: 'client_total',
    help: 'client total'
  }),

};

module.exports = metrics;