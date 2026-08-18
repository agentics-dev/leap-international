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

// GET /api/authors            -> all active authors (for bylines / author pages)
// GET /api/authors?slug=jane  -> single author
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { url, anonKey } = getSupabaseConfig();
    const slug = String(req.query.slug || '').trim();

    const params = new URLSearchParams({
      select: 'id,slug,name,name_zh,title,title_zh,credential,credential_zh,bio,bio_zh,photo_url,linkedin_url',
      is_active: 'eq.true',
      order: 'created_at.asc',
    });
    if (slug) {
      if (slug.length > 180) return json(res, 400, { error: 'Invalid author slug' });
      params.set('slug', `eq.${slug}`);
      params.set('limit', '1');
    }

    const response = await fetch(`${url}/rest/v1/authors?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Supabase authors fetch failed:', response.status);
      return json(res, 502, { error: 'Failed to fetch authors' });
    }

    const data = await response.json();
    if (slug) {
      return data.length > 0
        ? json(res, 200, data[0])
        : json(res, 404, { error: 'Author not found' });
    }
    return json(res, 200, data);
  } catch (error) {
    console.error('Error fetching authors:', error.message);
    return json(res, 500, { error: 'Failed to fetch authors' });
  }
};
