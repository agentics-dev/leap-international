// Compile each distinct page configuration; no Tailwind runtime is shipped.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const cssnano = require('cssnano');
const dist = path.resolve(process.argv[2] || 'dist');
const files = ['index.html', ...fs.readdirSync(path.join(dist, 'pages')).filter(f => f.endsWith('.html')).map(f => 'pages/' + f)];
const content = files.map(f => ({ raw: fs.readFileSync(path.join(dist, f), 'utf8'), extension: 'html' }));
content.push({ raw: fs.readdirSync(path.join(dist, 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(dist, 'js', f), 'utf8')).join('\n'), extension: 'js' });

(async () => {
  const cache = new Map();
  fs.mkdirSync(path.join(dist, 'css'), { recursive: true });
  for (const file of files) {
    const filename = path.join(dist, file);
    let html = fs.readFileSync(filename, 'utf8');
    if (!html.includes('cdn.tailwindcss.com')) continue;
    const match = html.match(/<script\b[^>]*id=["']tailwind-config["'][^>]*>([\s\S]*?)<\/script>/i);
    const sandbox = { tailwind: { config: {} } };
    if (match) vm.runInNewContext(match[1], sandbox, { timeout: 1000 });
    const config = JSON.parse(JSON.stringify(sandbox.tailwind.config));
    const hash = crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 12);
    if (!cache.has(hash)) {
      config.content = content;
      config.plugins = [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')];
      const result = await postcss([tailwind(config), cssnano({ preset: 'default' })]).process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined });
      fs.writeFileSync(path.join(dist, 'css', `site-${hash}.css`), result.css);
      cache.set(hash, true);
    }
    html = html.replace(/<script\b[^>]*src=["']https:\/\/cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/gi, '');
    if (match) html = html.replace(match[0], '');
    html = html.replace('</head>', `<link rel="stylesheet" href="/css/site-${hash}.css">\n</head>`);
    fs.writeFileSync(filename, html);
  }
  console.log(`Compiled Tailwind: ${cache.size} shared CSS configurations.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
