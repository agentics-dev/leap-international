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

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const slug = String(req.query.id || '').trim();
  if (!slug || slug.length > 180) {
    return json(res, 400, { error: 'Missing article slug' });
  }

  try {
    const { url, anonKey } = getSupabaseConfig();
    const params = new URLSearchParams({
      slug: `eq.${slug}`,
      is_published: 'eq.true',
      select: 'id,slug,category,title_en,title_zh,title_zh_cn,excerpt_en,excerpt_zh,excerpt_zh_cn,content_en,content_zh,content_zh_cn,cover_image_url,publish_time',
      limit: '1',
    });

    const response = await fetch(`${url}/rest/v1/news_activities?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Supabase news detail fetch failed:', response.status);
      return json(res, 502, { error: 'Failed to fetch News Detail' });
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return json(res, 200, data[0]);
    }
    return json(res, 404, { error: 'Article not found' });
  } catch (error) {
    console.error('Error fetching News Detail:', error.message);
    return json(res, 500, { error: 'Failed to fetch News Detail' });
  }
};
