const { NetMatcher } = require('../net');

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

});
