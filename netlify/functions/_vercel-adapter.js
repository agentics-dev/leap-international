/**
 * _vercel-adapter.js — runs a Vercel-style handler (req, res) as a Netlify function.
 *
 * The content APIs in /api are written for Vercel's Node signature. This adapter
 * lets the exact same code serve Netlify deploys via the /api/* -> /.netlify/functions/*
 * redirect in netlify.toml.
 */
module.exports = function adapt(vercelHandler) {
  return async (event) => {
    const req = {
      method: event.httpMethod,
      query: event.queryStringParameters || {},
      headers: event.headers || {},
      body: event.body,
    };
    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      setHeader(key, value) { this.headers[key] = value; },
      end(chunk) { this.body = chunk == null ? '' : String(chunk); },
    };
    await vercelHandler(req, res);
    return { statusCode: res.statusCode, headers: res.headers, body: res.body };
  };
};
