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

// GET /api/case-studies              -> published case study list
// GET /api/case-studies?slug=acme    -> single case study with metrics/quote
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { url, anonKey } = getSupabaseConfig();
    const slug = String(req.query.slug || '').trim();

    const params = new URLSearchParams({ is_published: 'eq.true' });
    if (slug) {
      if (slug.length > 180) return json(res, 400, { error: 'Invalid case study slug' });
      params.set('slug', `eq.${slug}`);
      params.set('limit', '1');
      params.set('select', [
        'id', 'slug', 'client_name', 'client_label_en', 'client_label_zh', 'industry',
        'title_en', 'title_zh', 'summary_en', 'summary_zh', 'body_en', 'body_zh',
        'metrics', 'quote', 'quote_author', 'services', 'published_at', 'updated_at',
        'authors(id,slug,name,name_zh,title,title_zh,credential,credential_zh,photo_url)',
      ].join(','));
    } else {
      params.set('select', 'id,slug,client_label_en,client_label_zh,industry,title_en,title_zh,summary_en,summary_zh,metrics,published_at');
      params.set('order', 'published_at.desc');
    }

    const response = await fetch(`${url}/rest/v1/case_studies?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Supabase case studies fetch failed:', response.status);
      return json(res, 502, { error: 'Failed to fetch case studies' });
    }

    const data = await response.json();
    if (slug) {
      return data.length > 0
        ? json(res, 200, data[0])
        : json(res, 404, { error: 'Case study not found' });
    }
    return json(res, 200, data);
  } catch (error) {
    console.error('Error fetching case studies:', error.message);
    return json(res, 500, { error: 'Failed to fetch case studies' });
  }
};
