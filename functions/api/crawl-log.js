// functions/api/crawl-log.js
// GEO Phase 4.2 — 记录 AI 爬虫访问（kind='crawl'，来自 _middleware.js）
// 和 AI 引擎 referral（kind='referral'，来自页面里的 ai-referral-beacon）。
// Cloudflare Pages Function：路由 POST /api/crawl-log
// 写入 Supabase crawl_events 表（需先执行 supabase/migrations/20260814_phase4_crawl_events.sql）。

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// AI crawlers we track (UA substrings -> normalized bot name).
const KNOWN_BOTS = {
  GPTBot: 'GPTBot',
  'OAI-SearchBot': 'OAI-SearchBot',
  'ChatGPT-User': 'ChatGPT-User',
  ClaudeBot: 'ClaudeBot',
  'Claude-User': 'Claude-User',
  PerplexityBot: 'PerplexityBot',
  Bytespider: 'Bytespider',
  'Meta-ExternalAgent': 'Meta-ExternalAgent',
  Amazonbot: 'Amazonbot',
  Applebot: 'Applebot',
  CCBot: 'CCBot',
  'cohere-ai': 'cohere-ai',
  bingbot: 'bingbot',
};

const KNOWN_ENGINES = ['chatgpt', 'openai', 'perplexity', 'copilot', 'bing', 'claude', 'gemini', 'bard', 'doubao', 'you', 'phind'];

function clip(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return json(500, { error: 'Supabase credentials not configured' });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body || typeof body !== 'object') {
      return json(400, { error: 'Invalid payload' });
    }

    const kind = body.kind === 'referral' ? 'referral' : 'crawl';
    const row = {
      kind,
      path: clip(body.path, 500) || '/',
      referer: clip(body.referer, 1000) || null,
      user_agent: clip(body.user_agent || body.ua, 500) || null,
      bot: null,
      engine: null,
    };

    if (kind === 'crawl') {
      const bot = KNOWN_BOTS[body.bot] || null;
      if (!bot) return json(202, { ignored: true });
      row.bot = bot;
    } else {
      const engine = String(body.engine || '').toLowerCase();
      if (!KNOWN_ENGINES.includes(engine)) return json(202, { ignored: true });
      row.engine = engine;
    }

    const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/crawl_events`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      return json(502, { error: 'Failed to log event' });
    }
    return json(201, { logged: true });
  } catch (error) {
    return json(500, { error: 'Failed to log event' });
  }
}
