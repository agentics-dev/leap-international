const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const OpenCC = require('opencc-js');

test('About page simplified copy contains no traditional characters', () => {
  const html = fs.readFileSync(path.join(__dirname, '../pages/our-culture.html'), 'utf8');
  const document = new JSDOM(html).window.document;
  const convert = OpenCC.Converter({ from: 'hk', to: 'cn' });
  const nodes = [...document.querySelectorAll('.lang-zh-Hans')];

  assert.ok(nodes.length >= 70, 'expected to audit all simplified page copy');
  for (const node of nodes) {
    const text = node.textContent.trim();
    assert.equal(text, convert(text), `traditional characters remain in: ${text.slice(0, 80)}`);
  }
});
