#!/usr/bin/env node
/**
 * build-seo.js — backend SEO/GEO build step for the Leap International site.
 *
 * Runs against the assembled dist/ folder. Zero changes to visible page content;
 * everything here is machine-readable metadata, schema, or crawler-facing files.
 *
 *   1. Canonical host normalization (legacy www -> apex) in HTML/XML/TXT
 *   2. Title / meta description rewrite from seo/seo.config.json
 *   3. noindex,nofollow on transactional (checkout/payment) pages
 *   4. JSON-LD: dateModified on every page, BreadcrumbList where missing,
 *      Organization sameAs enrichment from config
 *   5. sitemap.xml regeneration (all public pages + published news from Supabase)
 *   6. llms.txt + llms-full.txt generation
 *   7. IndexNow key file
 *   8. Title/meta length lint (audit standard: title 30-60, description 120-160)
 *
 * Usage: node scripts/build-seo.js [distDir]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo', 'seo.config.json'), 'utf8'));

const HOST = CONFIG.canonicalHost.replace(/\/+$/, '');
const LEGACY_HOSTS = CONFIG.legacyHosts || [];
const TODAY = new Date().toISOString().slice(0, 10);

const report = { hostFixes: 0, metaRewrites: [], noindex: [], schema: [], lint: [] };

/* ---------------------------------- utils ---------------------------------- */

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function isTransactional(relName) {
  return CONFIG.transactionalPatterns.some((pat) => relName.startsWith(pat));
}

/** mtime of the SOURCE file (dist copies get fresh mtimes, source carries history). */
function sourceMtime(rel) {
  try {
    return fs.statSync(path.join(ROOT, rel)).mtime.toISOString().slice(0, 10);
  } catch {
    return TODAY;
  }
}

function replaceTag(html, regex, replacement) {
  // replacement may be a string (treated literally — no $-pattern substitution)
  // or a function (passed through to String.replace).
  const fn = typeof replacement === 'function' ? replacement : () => replacement;
  return html.replace(regex, fn);
}

/* ------------------------- 1. canonical host fix --------------------------- */

function normalizeHosts(content) {
  let out = content;
  const apex = HOST.replace(/^https?:\/\//, '');
  for (const legacy of LEGACY_HOSTS) {
    // protocol-prefixed references (canonical, og:url, schema @id, sitemap)
    const prefixed = out.split(legacy).length - 1;
    if (prefixed > 0) {
      out = out.split(legacy).join(HOST);
      report.hostFixes += prefixed;
    }
    // bare domain mentions (display text, JS strings) — e.g. "www.leapcorpser.com"
    const bare = legacy.replace(/^https?:\/\//, '');
    const bareHits = out.split(bare).length - 1;
    if (bareHits > 0) {
      out = out.split(bare).join(apex);
      report.hostFixes += bareHits;
    }
  }
  return out;
}

/* ------------------------- 2. title / description --------------------------- */

function applyMeta(html, meta) {
  // NOTE: replacements are built from capture-group arguments via functions,
  // because meta copy contains prices like "HK$1,500" — in string replacements
  // "$1" would be interpreted as a capture-group reference and corrupt the tag.
  if (meta.title) {
    html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, () => `<title>${meta.title}</title>`);
    // keep og:title / twitter:title consistent
    html = replaceTag(html,
      /(<meta[^>]*property="og:title"[^>]*content=")[^"]*(")/i, (m, a, b) => a + meta.title + b);
    html = replaceTag(html,
      /(<meta[^>]*content=")[^"]*("[^>]*property="og:title")/i, (m, a, b) => a + meta.title + b);
    html = replaceTag(html,
      /(<meta[^>]*name="twitter:title"[^>]*content=")[^"]*(")/i, (m, a, b) => a + meta.title + b);
    html = replaceTag(html,
      /(<meta[^>]*content=")[^"]*("[^>]*name="twitter:title")/i, (m, a, b) => a + meta.title + b);
  }
  if (meta.description) {
    html = replaceTag(html,
      /(<meta[^>]*name="description"[^>]*content=")[^"]*(")/i, (m, a, b) => a + meta.description + b);
    html = replaceTag(html,
      /(<meta[^>]*content=")[^"]*("[^>]*name="description")/i, (m, a, b) => a + meta.description + b);
    html = replaceTag(html,
      /(<meta[^>]*property="og:description"[^>]*content=")[^"]*(")/i, (m, a, b) => a + meta.description + b);
    html = replaceTag(html,
      /(<meta[^>]*content=")[^"]*("[^>]*property="og:description")/i, (m, a, b) => a + meta.description + b);
    html = replaceTag(html,
      /(<meta[^>]*name="twitter:description"[^>]*content=")[^"]*(")/i, (m, a, b) => a + meta.description + b);
    html = replaceTag(html,
      /(<meta[^>]*content=")[^"]*("[^>]*name="twitter:description")/i, (m, a, b) => a + meta.description + b);
  }
  return html;
}

/* ------------------------------ 3. noindex --------------------------------- */

function applyNoindex(html) {
  if (/<meta[^>]*name="robots"/i.test(html)) {
    return html.replace(/<meta[^>]*name="robots"[^>]*content="[^"]*"[^>]*>/i,
      '<meta name="robots" content="noindex,nofollow"/>');
  }
  return html.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex,nofollow"/>');
}

/* ------------------------- 3b. AI-referral beacon --------------------------- */

// Phase 4.1 companion: detects visits referred by AI engines and beacons them
// to /api/crawl-log. CSP-safe: connect-src 'self' + inline scripts allowed.
const REFERRAL_BEACON = `<script id="ai-referral-beacon">(function(){try{
var r=document.referrer||'';if(!r||!navigator.sendBeacon)return;
var m=r.match(/chatgpt|openai|perplexity|copilot|bing\\.com|claude|gemini|bard|doubao|you\\.com|phind/i);if(!m)return;
var e=m[0].replace(/\\.com$/,'').toLowerCase();
if(e==='openai')e='chatgpt';if(e==='bard')e='gemini';if(e==='bing')e='copilot';
navigator.sendBeacon('/api/crawl-log',JSON.stringify({kind:'referral',engine:e,path:location.pathname+location.search,referer:r}));
}catch(_){}})();</script>`;

function injectReferralBeacon(html) {
  if (html.includes('ai-referral-beacon')) return html;
  return html.replace(/<\/body>/i, () => `${REFERRAL_BEACON}\n</body>`);
}

/* ------------------------------ 4. JSON-LD ---------------------------------- */

function parseLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push({ full: m[0], json: JSON.parse(m[1]) });
    } catch { /* leave malformed blocks untouched */ }
  }
  return blocks;
}

function serializeLd(block) {
  return `<script type="application/ld+json">\n${JSON.stringify(block, null, 2)}\n</script>`;
}

function eachLdNode(blocks, fn) {
  for (const b of blocks) {
    const nodes = Array.isArray(b.json) ? b.json : [b.json];
    for (const node of nodes) fn(node);
  }
}

function injectSchema(html, rel, pageUrl, pageTitle) {
  const date = sourceMtime(rel);
  const blocks = parseLdBlocks(html);
  let hasWebPage = false;
  let hasBreadcrumb = false;

  eachLdNode(blocks, (node) => {
    if (node['@type'] === 'WebPage') {
      hasWebPage = true;
      node.dateModified = date;
      if (!node.datePublished) node.datePublished = date;
      node.url = pageUrl;
    }
    if (node['@type'] === 'BreadcrumbList') hasBreadcrumb = true;
    if ((node['@type'] === 'Organization' || node['@type'] === 'LocalBusiness') && node.url) {
      node.url = HOST + '/';
      if (CONFIG.organization.sameAs.length > 0) node.sameAs = CONFIG.organization.sameAs;
      else if (node.sameAs) delete node.sameAs; // remove self-referential sameAs
    }
  });

  // rebuild html with modified blocks (function replacement: JSON may contain $ patterns)
  let out = html;
  for (const b of blocks) out = out.replace(b.full, () => serializeLd(b.json));

  const injections = [];
  if (!hasWebPage) {
    injections.push(serializeLd({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: pageTitle,
      datePublished: date,
      dateModified: date,
      isPartOf: { '@id': `${HOST}/#org` },
    }));
  }
  if (!hasBreadcrumb && rel !== 'index.html') {
    const pageName = pageTitle.split(/[|—]/)[0].trim();
    injections.push(serializeLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${HOST}/` },
        { '@type': 'ListItem', position: 2, name: pageName, item: pageUrl },
      ],
    }));
  }
  if (injections.length > 0) {
    const snippet = `${injections.join('\n')}\n</head>`;
    out = out.replace(/<\/head>/i, () => snippet);
  }
  report.schema.push(`${rel}: dateModified=${date}${hasWebPage ? '' : ' (+WebPage)'}${hasBreadcrumb ? '' : ' (+BreadcrumbList)'}`);
  return out;
}

/* ------------------------------ 5. sitemap ---------------------------------- */

const SITEMAP_META = {
  'index.html': { priority: '1.0', changefreq: 'weekly' },
  'pricing.html': { priority: '0.9', changefreq: 'weekly' },
  'incorporation-foreigners.html': { priority: '0.9', changefreq: 'weekly' },
  'incorporation-locals.html': { priority: '0.9', changefreq: 'weekly' },
  'accounting.html': { priority: '0.9', changefreq: 'weekly' },
  'corporate-secretary.html': { priority: '0.9', changefreq: 'weekly' },
  'news.html': { priority: '0.8', changefreq: 'daily' },
  'news-detail.html': { priority: '0.6', changefreq: 'weekly' },
  'faqs.html': { priority: '0.7', changefreq: 'monthly' },
  'our-culture.html': { priority: '0.7', changefreq: 'monthly' },
  'contact.html': { priority: '0.8', changefreq: 'monthly' },
  'privacy-policy.html': { priority: '0.6', changefreq: 'yearly' },
  'terms-of-service.html': { priority: '0.6', changefreq: 'yearly' },
  'get-started.html': { priority: '0.5', changefreq: 'monthly' },
};

async function fetchPublishedNews() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const base = `${url.replace(/\/+$/, '')}/rest/v1/news_activities`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const query = (select) => new URLSearchParams({
    select, is_published: 'eq.true', order: 'publish_time.desc', limit: '500',
  }).toString();
  try {
    // extended select includes feed fields; fall back if migration not applied
    let res = await fetch(`${base}?${query('slug,title_en,excerpt_en,publish_time,updated_at')}`, { headers });
    if (res.status === 400) {
      res = await fetch(`${base}?${query('slug,publish_time')}`, { headers });
    }
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function generateSitemap(pageFiles, news) {
  const entries = [];
  for (const rel of pageFiles) {
    const name = path.basename(rel);
    const loc = rel === 'index.html' ? `${HOST}/` : `${HOST}/pages/${name}`;
    const meta = SITEMAP_META[name] || { priority: '0.8', changefreq: 'monthly' };
    entries.push({ loc, lastmod: sourceMtime(rel), ...meta });
  }
  for (const item of news) {
    if (!item.slug) continue;
    entries.push({
      loc: `${HOST}/pages/news-detail.html?slug=${encodeURIComponent(item.slug)}`,
      lastmod: (item.updated_at || item.publish_time || TODAY).slice(0, 10),
      changefreq: 'monthly',
      priority: '0.7',
      news: true,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
  return { total: entries.length, news: entries.filter((e) => e.news).length };
}

/* ------------------------------ 6. llms.txt --------------------------------- */

function generateLlms() {
  const L = CONFIG.llms;
  const lines = [`# ${L.name}`, '', `> ${L.summary}`, ''];
  const full = [`# ${L.name}`, '', `> ${L.summary}`, ''];

  for (const section of L.sections) {
    lines.push(`## ${section.heading}`, '');
    full.push(`## ${section.heading}`, '');
    for (const item of section.items) {
      lines.push(`- [${item.name}](${HOST}${item.url})`);
      full.push(`- [${item.name}](${HOST}${item.url})`);
    }
    lines.push('');
    full.push('');
  }

  full.push('## Company details', '');
  full.push(`- Legal name: ${L.name}`);
  full.push(`- Address: ${L.contact.address}`);
  full.push(`- Phone: ${L.contact.phone}`);
  full.push(`- Business hours: ${L.contact.hours}`);
  full.push(`- Languages: English, Traditional Chinese`);
  full.push(`- Sitemap: ${HOST}/sitemap.xml`);
  full.push(`- News feed (RSS): ${HOST}/feed.xml`);
  full.push('');

  fs.writeFileSync(path.join(DIST, 'llms.txt'), lines.join('\n'));
  fs.writeFileSync(path.join(DIST, 'llms-full.txt'), full.join('\n'));
}

/* --------------------------- 6b. RSS feed (feed.xml) ------------------------ */

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateFeed(news) {
  const items = news.filter((n) => n.slug && n.title_en).slice(0, 50).map((n) => {
    const link = `${HOST}/pages/news-detail.html?slug=${encodeURIComponent(n.slug)}`;
    const pub = n.publish_time ? new Date(n.publish_time).toUTCString() : new Date().toUTCString();
    return `    <item>
      <title>${xmlEscape(n.title_en)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${pub}</pubDate>
      ${n.excerpt_en ? `<description>${xmlEscape(n.excerpt_en)}</description>` : ''}
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(CONFIG.llms.name)} — News &amp; Activities</title>
    <link>${HOST}/pages/news.html</link>
    <description>News, guides and Hong Kong policy updates from ${xmlEscape(CONFIG.llms.name)}.</description>
    <language>en-hk</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(DIST, 'feed.xml'), xml);
  return items ? news.filter((n) => n.slug && n.title_en).slice(0, 50).length : 0;
}

/* --------------------------- 6c. FAQ schema validation ---------------------- */

const FAQ_MIN_QUESTIONS = 5; // audit standard: 5+ question-style Q&A per FAQ block

function validateFaqSchemas(pageFiles) {
  const findings = [];
  for (const rel of pageFiles) {
    const html = fs.readFileSync(path.join(DIST, rel), 'utf8');
    for (const b of parseLdBlocks(html)) {
      const nodes = Array.isArray(b.json) ? b.json : [b.json];
      for (const node of nodes) {
        if (node['@type'] === 'FAQPage') {
          const count = Array.isArray(node.mainEntity) ? node.mainEntity.length : 0;
          findings.push({ rel, count, ok: count >= FAQ_MIN_QUESTIONS });
        }
      }
    }
  }
  return findings;
}

/* ----------------------------- 7. IndexNow key ------------------------------ */

function writeIndexNowKey() {
  fs.writeFileSync(path.join(DIST, `${CONFIG.indexNowKey}.txt`), CONFIG.indexNowKey);
}

/* --------------------------------- main ------------------------------------- */

async function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`dist folder not found: ${DIST}`);
    process.exit(1);
  }

  // admin panel ships at dist/admin (this repo's convention) — exclude from SEO processing
  const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html') && !f.includes('admin_dist')
    && !path.relative(DIST, f).split(path.sep).includes('admin'));
  const publicPages = [];

  for (const file of htmlFiles) {
    const rel = path.relative(DIST, file).split(path.sep).join('/');
    const name = path.basename(file);
    let html = fs.readFileSync(file, 'utf8');

    html = normalizeHosts(html);

    const transactional = rel.startsWith('pages/') && isTransactional(name);
    const meta = CONFIG.meta[name];

    if (transactional) {
      html = applyNoindex(html);
      report.noindex.push(rel);
    } else {
      if (meta) {
        html = applyMeta(html, meta);
        report.metaRewrites.push(rel);
      }
      const title = (CONFIG.meta[name] && CONFIG.meta[name].title)
        || (html.match(/<title>([\s\S]*?)<\/title>/i) || [, name])[1].trim();
      const pageUrl = rel === 'index.html' ? `${HOST}/` : `${HOST}/${rel}`;
      html = injectSchema(html, rel, pageUrl, title);
      html = injectReferralBeacon(html);
      publicPages.push(rel);
    }

    fs.writeFileSync(file, html);
  }

  // normalize host in other machine-readable files that ship to dist
  for (const extra of ['robots.txt']) {
    const p = path.join(DIST, extra);
    if (fs.existsSync(p)) fs.writeFileSync(p, normalizeHosts(fs.readFileSync(p, 'utf8')));
  }

  const news = await fetchPublishedNews();
  const sitemapInfo = await generateSitemap(publicPages, news);
  const feedCount = generateFeed(news);
  generateLlms();
  writeIndexNowKey();

  // RSS autodiscovery on the homepage (machine-readable, no visible change)
  const indexPath = path.join(DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    if (!indexHtml.includes('application/rss+xml')) {
      indexHtml = indexHtml.replace(/<\/head>/i,
        `<link rel="alternate" type="application/rss+xml" title="${CONFIG.llms.name} News" href="${HOST}/feed.xml"/>\n</head>`);
      fs.writeFileSync(indexPath, indexHtml);
    }
  }

  // FAQ schema audit (Phase 2.3)
  const faqFindings = validateFaqSchemas(publicPages);

  /* -------------------------------- 8. lint ---------------------------------- */
  for (const rel of publicPages) {
    const html = fs.readFileSync(path.join(DIST, rel), 'utf8');
    const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1].trim();
    const desc = (html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)
      || html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/i) || [, ''])[1].trim();
    const issues = [];
    if (title.length < 30 || title.length > 60) issues.push(`title ${title.length} chars`);
    if (desc.length < 120 || desc.length > 160) issues.push(`description ${desc.length} chars`);
    report.lint.push({ rel, title: title.length, desc: desc.length, issues });
  }

  /* -------------------------------- report ----------------------------------- */
  console.log('\n=== build-seo report ===');
  console.log(`Canonical host:        ${HOST}`);
  console.log(`Host refs normalized:  ${report.hostFixes}`);
  console.log(`Meta rewritten:        ${report.metaRewrites.length} pages`);
  console.log(`noindex applied:       ${report.noindex.length} transactional pages`);
  console.log(`Schema processed:      ${report.schema.length} pages`);
  console.log(`Sitemap:               ${sitemapInfo.total} URLs (${sitemapInfo.news} news articles${sitemapInfo.news === 0 ? ' — Supabase env not set, skipped' : ''})`);
  console.log(`RSS feed:              feed.xml (${feedCount} items)`);
  console.log(`llms.txt / llms-full:  written`);
  console.log(`IndexNow key file:     ${CONFIG.indexNowKey}.txt`);

  if (faqFindings.length > 0) {
    console.log('\n--- FAQPage schema check (min 5 Q&A) ---');
    for (const f of faqFindings) {
      console.log(`[${f.ok ? ' ok ' : 'WARN'}] ${f.rel}: ${f.count} Q&A pairs`);
    }
  } else {
    console.log('\n--- FAQPage schema check ---\n[WARN] no FAQPage schema found on any public page');
  }

  const bad = report.lint.filter((l) => l.issues.length > 0);
  console.log('\n--- title/meta lint (public pages) ---');
  for (const l of report.lint) {
    const flag = l.issues.length ? 'WARN' : ' ok ';
    console.log(`[${flag}] ${l.rel.padEnd(42)} title=${String(l.title).padStart(3)} desc=${String(l.desc).padStart(3)} ${l.issues.join('; ')}`);
  }
  if (bad.length > 0) console.log(`\n${bad.length} page(s) outside length guidelines (title 30-60, description 120-160).`);
  else console.log('\nAll public pages within length guidelines.');
}

main().catch((err) => { console.error(err); process.exit(1); });
