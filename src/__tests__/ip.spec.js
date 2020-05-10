const { NetMatcher } = require('../net');

describe('IP Net Matcher Test Suite', () => {
  it('should match nat network ', () => {
    const m = new NetMatcher(['192.168.1.1/24']);
    expect(m.ip_in_net('192.168.1.5')).toBeTruthy();
  });

  it('should match localhsot', async () => {
    const m = new NetMatcher(['127.0.0.1/24']);
    expect(await m.hostname_in_net('localhost')).toBeTruthy();
  });
});
