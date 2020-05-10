const { random_int } = require('../util');


describe('Util Test Suite', () => {
  it('should have all random data', () => {
    const s = new Set();
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < 1000; i++) {
      s.add(random_int(10, 15));
    }
    expect(s.size).toBe(5);
  });
});
