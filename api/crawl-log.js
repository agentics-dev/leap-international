function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase public API credentials are not configured');
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
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

// POST /api/crawl-log
//   { kind: 'crawl',    bot, path, user_agent }      (from edge middleware)
//   { kind: 'referral', engine, path, referer }      (from the on-page beacon)
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid payload' });
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
      if (!bot) return json(res, 202, { ignored: true });
      row.bot = bot;
    } else {
      const engine = String(body.engine || '').toLowerCase();
      if (!KNOWN_ENGINES.includes(engine)) return json(res, 202, { ignored: true });
      row.engine = engine;
    }

    const { url, anonKey } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/crawl_events`, {
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
      console.error('crawl_events insert failed:', response.status);
      return json(res, 502, { error: 'Failed to log event' });
    }
    return json(res, 201, { logged: true });
  } catch (error) {
    console.error('Error logging crawl event:', error.message);
    return json(res, 500, { error: 'Failed to log event' });
  }
};

module.exports.KNOWN_BOTS = KNOWN_BOTS;
module.exports.KNOWN_ENGINES = KNOWN_ENGINES;
