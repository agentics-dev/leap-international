/**
 * Cloudflare Pages middleware — AI-crawler access logging (Phase 4.2).
 *
 * Static HTML is served straight from the CDN, so crawler visits never touch a
 * function. This middleware runs at the edge in front of every request; when the
 * visitor is a known AI crawler fetching an HTML page, it fire-and-forgets a
 * record to /api/crawl-log and serves the page normally.
 */

const securityHeaders = require('./_security-headers');
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

  const url = new URL(context.request.url);
  // Only extensionless admin routes use the SPA shell. Missing JS/CSS stays 404.
  const adminRoute = /^\/admin(?:\/[^.]*)?\/?$/.test(url.pathname);
  let response;
  if (adminRoute && ['GET', 'HEAD'].includes(context.request.method)) {
    const shell = new URL('/admin/', url);
    response = await context.env.ASSETS.fetch(new Request(shell, context.request));
  } else {
    response = await context.next();
  }
  response = new Response(response.body, response);
  Object.entries(securityHeaders(url.protocol === 'https:')).forEach(([name, value]) => response.headers.set(name, value));
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}
