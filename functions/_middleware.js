/**
 * Cloudflare Pages middleware — AI-crawler access logging (Phase 4.2).
 *
 * Static HTML is served straight from the CDN, so crawler visits never touch a
 * function. This middleware runs at the edge in front of every request; when the
 * visitor is a known AI crawler fetching an HTML page, it fire-and-forgets a
 * record to /api/crawl-log and serves the page normally.
 */

const KNOWN_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'PerplexityBot', 'Bytespider',
  'Meta-ExternalAgent', 'Amazonbot', 'Applebot', 'CCBot', 'cohere-ai', 'bingbot',
];

function isHtmlRequest(pathname) {
  return pathname === '/' || pathname.endsWith('.html') || !pathname.includes('.');
}

export async function onRequest(context) {
  const ua = context.request.headers.get('user-agent') || '';
  const bot = KNOWN_BOTS.find((b) => ua.includes(b));

  if (bot) {
    const url = new URL(context.request.url);
    if (isHtmlRequest(url.pathname)) {
      const payload = {
        kind: 'crawl',
        bot,
        path: url.pathname + url.search,
        user_agent: ua,
      };
      context.waitUntil(
        fetch(`${url.origin}/api/crawl-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      );
    }
  }

  return context.next();
}
