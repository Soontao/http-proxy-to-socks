const { NetMatcher, get_internal_net_matcher } = require('../net');

describe('IP Net Matcher Test Suite', () => {

  it('should match nat network ', async () => {
    const m = new NetMatcher(['192.168.1.1/24']);
    expect(await m.ip_in_net('192.168.1.5')).toBeTruthy();
    await m.destroy();
  });

  it('should match localhost', async () => {
    const m = new NetMatcher(['127.0.0.1/24']);
    expect(await m.hostname_in_net('localhost')).toBeTruthy();
    await m.destroy();
  });

  it('should match internal net', async () => {
    const m = get_internal_net_matcher();
    expect(await m.cached_ip_in_net('192.168.1.1')).toBeTruthy();
    expect(await m.cached_ip_in_net('10.2.1.1')).toBeTruthy();
    await m.destroy();
  });

  it('should match internal net another instance', async () => {
    const m = get_internal_net_matcher('instance 2');
    expect(await m.cached_ip_in_net('192.168.1.2')).toBeTruthy();
    expect(await m.cached_ip_in_net('10.2.1.1')).toBeTruthy();
    await m.destroy();
  });

});
