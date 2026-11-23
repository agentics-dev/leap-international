// Local development server for the Leap International site.
// Serves the static site from dist/ and mirrors the production routing:
//   /admin/*            -> SPA fallback to admin_dist/index.html (Vercel rewrites)
//   /api/*, /.netlify/* -> stubbed serverless endpoints (need Supabase/Cybersource creds)
// Usage: node serve.js [port]

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'dist');
const PORT = Number(process.argv[2]) || 3000;
const { quoteOrder } = require('./functions/_order-validation');

const securityHeaders = require('./functions/_security-headers');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function send(res, status, body, type) {
  res.writeHead(status, { ...securityHeaders(false), 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function isWithin(root, file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function sendFile(res, filePath) {
  if (!isWithin(ROOT, filePath)) return send(res, 403, '403 Forbidden');

  try {
    const [root, resolved] = await Promise.all([fs.promises.realpath(ROOT), fs.promises.realpath(filePath)]);
    if (!isWithin(root, resolved)) return send(res, 403, '403 Forbidden');
    const stat = await fs.promises.stat(resolved);
    const file = stat.isDirectory() ? await fs.promises.realpath(path.join(resolved, 'index.html')) : resolved;
    if (!isWithin(root, file)) return send(res, 403, '403 Forbidden');
    const fileStat = stat.isDirectory() ? await fs.promises.stat(file) : stat;
    if (!fileStat.isFile()) return send(res, 404, '404 Not Found');
    const data = await fs.promises.readFile(file);
    const ext = path.extname(file).toLowerCase();
    return send(res, 200, data, MIME[ext] || 'application/octet-stream');
  } catch {
    return send(res, 404, fs.readFileSync(path.join(ROOT, '404.html')), MIME['.html']);
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return send(res, 400, '400 Bad Request');
  }
  if (url.includes('\0') || url.includes('\\') || url.split('/').includes('..')) {
    return send(res, 403, '403 Forbidden');
  }

  // Preview checkout totals with the same calculator used by the payment endpoints.
  if (url === '/api/quote-order' && req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const quote = quoteOrder(body.order, body.discount_code);
      send(res, quote.valid ? 200 : 400, JSON.stringify(quote), 'application/json');
    } catch {
      send(res, 400, JSON.stringify({ error: 'Invalid quote request' }), 'application/json');
    }
    return;
  }

  // Stubbed serverless APIs (require Supabase / Cybersource credentials).
  if (url.startsWith('/api/') || url.startsWith('/.netlify/functions/')) {
    send(res, 503, JSON.stringify({
      error: 'Serverless functions are not running in this local server.',
      hint: 'News, FAQs and payments need SUPABASE_URL / SUPABASE_ANON_KEY and Cybersource credentials.',
    }), 'application/json; charset=utf-8');
    return;
  }

  // Admin SPA fallback — mirrors the /admin/* redirect in netlify.toml.
  if (url === '/admin' || url.startsWith('/admin/')) {
    const sub = url.slice('/admin/'.length);
    if (url !== '/admin' && url !== '/admin/' && sub.includes('.')) {
      sendFile(res, path.join(ROOT, 'admin', sub));
      return;
    }
    sendFile(res, path.join(ROOT, 'admin', 'index.html'));
    return;
  }

  const cleanFile = path.join(ROOT, url + '.html');
  if (!path.extname(url) && fs.existsSync(cleanFile)) return sendFile(res, cleanFile);
  return sendFile(res, path.join(ROOT, url === '/' ? 'index.html' : url));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Leap International local server running:`);
  console.log(`  Website:  http://127.0.0.1:${PORT}/`);
  console.log(`  Admin:    http://127.0.0.1:${PORT}/admin/`);
});
