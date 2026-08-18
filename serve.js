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
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, '404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

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

  // Static site.
  let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, '403 Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    sendFile(res, filePath);
  });
});

server.listen(PORT, () => {
  console.log(`Leap International local server running:`);
  console.log(`  Website:  http://localhost:${PORT}/`);
  console.log(`  Admin:    http://localhost:${PORT}/admin/`);
});
