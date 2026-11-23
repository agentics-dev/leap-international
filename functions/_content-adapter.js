// Reuse the content handlers without mutating global environment variables.
module.exports = function adapt(handler) {
  return async ({ request, env }) => {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    if (!(env.SUPABASE_URL || env.VITE_SUPABASE_URL) || !(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)) {
      return new Response(JSON.stringify({ error: 'Content service is not configured' }), { status: 503, headers });
    }
    const req = { method: request.method, query: Object.fromEntries(new URL(request.url).searchParams), headers: Object.fromEntries(request.headers) };
    let body = '';
    const res = { statusCode: 200, setHeader: (name, value) => headers.set(name, value), end: value => { body = String(value || ''); } };
    await handler(req, res, env);
    return new Response(body, { status: res.statusCode, headers });
  };
};
