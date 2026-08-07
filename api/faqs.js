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

  try {
    const { url, anonKey } = getSupabaseConfig();
    const params = new URLSearchParams({
      select: 'id,question_en,answer_en,question_zh,answer_zh,created_at',
      order: 'created_at.asc',
    });

    const response = await fetch(`${url}/rest/v1/faqs?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Supabase FAQ fetch failed:', response.status);
      return json(res, 502, { error: 'Failed to fetch FAQs' });
    }

    return json(res, 200, await response.json());
  } catch (error) {
    console.error('Error fetching FAQs:', error.message);
    return json(res, 500, { error: 'Failed to fetch FAQs' });
  }
};
