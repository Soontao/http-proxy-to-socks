const { Counter } = require('prom-client');

const metrics = {
  direct_check_counter: new Counter({ name: 'direct_check_counter', help: 'direct check counter' }),
  direct_check_cache_counter: new Counter({ name: 'direct_check_cache_counter', help: 'direct check cache hit counter' }),
  request_counter: new Counter({ name: 'request_counter', help: 'http request counter' }),
  connect_counter: new Counter({ name: 'connect_counter', help: 'http connect counter' }),
  dns_query_counter: new Counter({ name: 'dns_query_counter', help: 'dns query counter' }),
  dns_query_time_ms_counter: new Counter({ name: 'dns_query_time_ms_counter', help: 'dns query time (ms)' }),
  dns_query_timeout_counter: new Counter({ name: 'dns_query_timeout_counter', help: 'dns query timeout counter' }),
  ip_determine_counter: new Counter({ name: 'ip_determine_counter', help: 'ip determine counter' }),
  client_counter: new Counter({ name: 'client_counter', help: 'client counter' }),
};

module.exports = metrics;