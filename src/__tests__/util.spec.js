const { random_int } = require('../util');
const { runOnceWrapper } = require('../v2/Utils');

describe('Util Test Suite', () => {

  it('should have all random data', () => {
    const s = new Set();
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < 1000; i++) {
      s.add(random_int(10, 15));
    }
    expect(s.size).toBe(5);
  });

  it('should run only one times', () => {
    let counter = 0;
    const func = runOnceWrapper((a, b) => a + b, () => counter++);
    expect(func(1, 2)).toEqual(3);
    expect(func(4, 5)).toEqual(9);
    expect(counter).toEqual(1);
  });

});
