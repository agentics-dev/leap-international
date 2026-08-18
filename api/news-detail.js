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

const BASE_SELECT = 'id,slug,category,title_en,title_zh,title_zh_cn,excerpt_en,excerpt_zh,excerpt_zh_cn,content_en,content_zh,content_zh_cn,cover_image_url,publish_time';
// Phase 3 fields (author byline, sources, key stats, updated_at) — require
// migration 20260814_phase3_cms_extensions.sql. Falls back automatically.
const EXTENDED_SELECT = BASE_SELECT + ',updated_at,sources,key_stats,authors(id,slug,name,name_zh,title,title_zh,credential,credential_zh,photo_url,linkedin_url)';

async function fetchArticle(url, anonKey, select, slug) {
  const params = new URLSearchParams({
    slug: `eq.${slug}`,
    is_published: 'eq.true',
    select,
    limit: '1',
  });
  return fetch(`${url}/rest/v1/news_activities?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });
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

    let response = await fetchArticle(url, anonKey, EXTENDED_SELECT, slug);
    if (response.status === 400) {
      // Phase 3 migration not applied yet — fall back to base columns.
      response = await fetchArticle(url, anonKey, BASE_SELECT, slug);
    }

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
