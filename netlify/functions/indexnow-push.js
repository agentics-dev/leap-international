/**
 * Netlify Function: indexnow-push
 *
 * Pushes site URLs to IndexNow after a deploy so Bing-powered search
 * (Copilot, ChatGPT browsing) picks up changes the same day.
 *
 * Trigger options:
 *   - Netlify deploy webhook: Site settings -> Build & deploy -> Deploy notifications
 *     -> "Outgoing webhook" on "Deploy succeeded" -> https://<site>/.netlify/functions/indexnow-push
 *   - Manual: POST/GET the function URL. Body may be {"urls": [...]} to push
 *     specific URLs; otherwise the full sitemap is pushed.
 */
const fs = require('fs');
const path = require('path');

const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'seo', 'seo.config.json'), 'utf8')
);
const HOST = CONFIG.canonicalHost.replace(/\/+$/, '');
const KEY = CONFIG.indexNowKey;

async function push(urls) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(HOST).host,
      key: KEY,
      keyLocation: `${HOST}/${KEY}.txt`,
      urlList: urls.slice(0, 10000),
    }),
  });
  return res.status;
}

exports.handler = async (event) => {
  try {
    let urls = [];
    if (event.body) {
      const payload = JSON.parse(event.body);
      if (Array.isArray(payload.urls)) urls = payload.urls;
    }
    if (urls.length === 0) {
      const res = await fetch(`${HOST}/sitemap.xml`);
      const xml = await res.text();
      urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    }
    const status = await push(urls);
    return {
      statusCode: 200,
      body: JSON.stringify({ pushed: Math.min(urls.length, 10000), indexnowStatus: status }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
