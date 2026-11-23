const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dist = path.resolve(process.argv[2] || 'dist');
const files = ['index.html', ...fs.readdirSync(path.join(dist, 'pages')).filter(f => f.endsWith('.html')).map(f => 'pages/' + f)];
for (const file of files) {
  if (['pages/news-detail.html'].includes(file)) continue;
  const filename = path.join(dist, file);
  let html = fs.readFileSync(filename, 'utf8');
  if (html.includes('leap-page-metadata')) continue;
  const dom = new JSDOM(html), doc = dom.window.document;
  const heading = doc.querySelector('main h1, h1');
  const metadata = {};
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  for (const [lang, cls] of [['en', '.lang-en'], ['zh-Hant', '.lang-zh'], ['zh-Hans', '.lang-zh-Hans']]) {
    const title = heading && heading.querySelector(cls);
    const section = heading && (heading.closest('section') || heading.parentElement.parentElement);
    const paragraph = section && Array.from(section.querySelectorAll('p')).map(p => p.matches(cls) ? p : p.querySelector(cls)).find(p => p && clean(p.textContent).length > 20);
    metadata[lang] = {
      title: lang === 'en' ? doc.title : title ? clean(title.textContent) + ' | Leap International' : doc.title,
      description: lang === 'en' ? doc.querySelector('meta[name="description"]')?.content : paragraph ? clean(paragraph.textContent) : title ? clean(title.textContent) + ' | Leap International' : undefined,
    };
  }
  const canonical = doc.querySelector('link[rel="canonical"]')?.href || 'https://leapcorpser.com/' + (file === 'index.html' ? '' : file.replace(/\.html$/, ''));
  const links = ['en', 'zh-Hant', 'zh-Hans', 'x-default'].map(lang => {
    const url = new URL(canonical); url.hash = ''; url.searchParams.delete('lang');
    if (lang !== 'x-default') url.searchParams.set('lang', lang);
    return `<link rel="alternate" hreflang="${lang}" href="${url.href.replace(/&/g, '&amp;')}">`;
  }).join('\n');
  // Reuse the approved visible translations; do not invent new service claims.
  html = html.replace('</head>', `<script type="application/json" id="leap-page-metadata">${JSON.stringify(metadata).replace(/</g, '\\u003c')}</script>\n${doc.querySelector('link[hreflang]') ? '' : links}\n</head>`);
  fs.writeFileSync(filename, html);
  dom.window.close();
}
