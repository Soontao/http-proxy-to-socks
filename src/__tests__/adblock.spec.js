const { contentTypes, filterEngine } = require('adblockpluscore');
const { Filter } = require('adblockpluscore/lib/filterClasses');
const { readFile } = require('fs').promises;
const path = require('path');
const { parse_adblock_filter, get_gfw_list_matcher } = require('../gfwlist');

describe('AdBlock Test Suite', () => {

  beforeAll(async () => {
    await filterEngine.initialize([]);
  });

  beforeEach(() => {
    filterEngine.clear();
  });

  const match = url => filterEngine.match(url, contentTypes.OTHER);

  it('should block site', async () => {
    [
      '!qq',
      '/annoying-ad^$image',
      '||example.com/social-widget.html^',
      '||google.com'
    ].map(Filter.fromText).forEach(filterEngine.add);


    expect(match('https://google.com')).not.toBeNull();
    expect(match('http://qq.com')).toBeNull();
  });

  it('should parse matcher', async () => {

    const fileContent = await readFile(path.join(__dirname, './adblock.gfw.part.ini'), { encoding: 'UTF-8' });
    const filters = parse_adblock_filter(fileContent);

    filters.forEach(item => filterEngine.add(item));

    expect(match('http://altrec.com/qq')).not.toBeNull();
    expect(match('http://google.com')).toBeNull();

  });

  it('should test gfw match', async () => {

    const match = await get_gfw_list_matcher();

    // singleton
    expect(await get_gfw_list_matcher()).toEqual(await get_gfw_list_matcher());

    expect(match('http://a.google.com')).not.toBeNull();
    expect(match('https://img.google.com')).not.toBeNull();
    expect(match('http://qq.com')).toBeNull();
    expect(match('http://baidu.com')).toBeNull();

  });

});