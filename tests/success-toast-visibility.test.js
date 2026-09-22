const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const files = ['index.html', ...fs.readdirSync(path.join(root, 'pages'))
  .filter(file => file.endsWith('.html'))
  .map(file => `pages/${file}`)];

test('success toasts stay hidden until explicitly shown on every page', () => {
  const missingHidden = [];
  const missingVisible = [];

  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    if (!html.includes('.success-toast') && !html.includes('class="success-toast"')) continue;

    const baseRule = html.match(/\.success-toast\s*\{([^}]*)\}/);
    const showRule = html.match(/\.success-toast\.show\s*\{([^}]*)\}/);
    if (!baseRule || !/visibility:\s*hidden\s*;/.test(baseRule[1])) missingHidden.push(file);
    if (!showRule || !/visibility:\s*visible\s*;/.test(showRule[1])) missingVisible.push(file);
  }

  assert.deepEqual(missingHidden, [], `Toast visible before success on: ${missingHidden.join(', ')}`);
  assert.deepEqual(missingVisible, [], `Toast fails to appear after success on: ${missingVisible.join(', ')}`);
});
