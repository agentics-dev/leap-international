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

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const page = clampInt(req.query.page, 0, 0, 1000);
    const pageSize = clampInt(req.query.pageSize, 9, 1, 24);
    const offset = page * pageSize;
    const { url, anonKey } = getSupabaseConfig();
    const params = new URLSearchParams({
      select: 'id,slug,category,title_en,title_zh,excerpt_en,excerpt_zh,cover_image_url,publish_time',
      is_published: 'eq.true',
      order: 'publish_time.desc',
      offset: String(offset),
      limit: String(pageSize),
    });

    const response = await fetch(`${url}/rest/v1/news_activities?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'count=exact',
      },
    });

    if (!response.ok) {
      console.error('Supabase news fetch failed:', response.status);
      return json(res, 502, { error: 'Failed to fetch News' });
    }

    const count = response.headers.get('content-range')?.split('/')[1] || '0';
    return json(res, 200, { data: await response.json(), count: Number.parseInt(count, 10) || 0 });
  } catch (error) {
    console.error('Error fetching News:', error.message);
    return json(res, 500, { error: 'Failed to fetch News' });
  }
};
