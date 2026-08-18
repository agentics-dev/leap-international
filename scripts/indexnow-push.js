#!/usr/bin/env node
/**
 * indexnow-push.js — push URLs to IndexNow (Bing / Yandex / Naver).
 *
 * Pushing on every publish means new/updated content reaches Bing-powered
 * search (incl. Copilot and ChatGPT's browsing index) the same day,
 * instead of waiting for a re-crawl.
 *
 * CLI usage:
 *   node scripts/indexnow-push.js                 # push every URL in dist/sitemap.xml
 *   node scripts/indexnow-push.js <url> [url...]  # push specific URLs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo', 'seo.config.json'), 'utf8'));
const HOST = CONFIG.canonicalHost.replace(/\/+$/, '');
const KEY = CONFIG.indexNowKey;

async function pushToIndexNow(urls) {
  if (urls.length === 0) return { skipped: true };
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(HOST).host,
      key: KEY,
      keyLocation: `${HOST}/${KEY}.txt`,
      urlList: urls.slice(0, 10000), // API limit per request
    }),
  });
  return { status: res.status, count: Math.min(urls.length, 10000) };
}

async function main() {
  let urls = process.argv.slice(2);
  if (urls.length === 0) {
    const sitemapPath = path.join(ROOT, 'dist', 'sitemap.xml');
    const xml = fs.readFileSync(sitemapPath, 'utf8');
    urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  }
  console.log(`Pushing ${urls.length} URL(s) to IndexNow...`);
  const result = await pushToIndexNow(urls);
  console.log('Result:', JSON.stringify(result));
  if (result.status && result.status >= 400) process.exit(1);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { pushToIndexNow };
