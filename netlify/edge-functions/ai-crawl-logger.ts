/**
 * Netlify Edge Function — AI-crawler access logging (Phase 4.2).
 * Deno runtime. Mirrors functions/_middleware.js (Cloudflare Pages):
 * known AI crawler + HTML page request -> fire-and-forget POST to /api/crawl-log.
 */

const KNOWN_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'PerplexityBot', 'Bytespider',
  'Meta-ExternalAgent', 'Amazonbot', 'Applebot', 'CCBot', 'cohere-ai', 'bingbot',
];

export default async (request: Request, context: any) => {
  const ua = request.headers.get('user-agent') || '';
  const bot = KNOWN_BOTS.find((b) => ua.includes(b));

  if (bot) {
    const url = new URL(request.url);
    const isHtml = url.pathname === '/' || url.pathname.endsWith('.html') || !url.pathname.includes('.');
    if (isHtml) {
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
};
