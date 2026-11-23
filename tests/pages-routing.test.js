const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const filename = path.resolve(__dirname, '../functions/_middleware.js');
const source = fs.readFileSync(filename, 'utf8').replace('export async function onRequest', 'async function onRequest');
const handle = vm.runInThisContext(`(require) => { ${source}; return onRequest; }`, { filename })(createRequire(filename));

test('Pages admin deep links use the admin shell; assets and public paths retain their status', async () => {
  for (const route of ['/admin', '/admin/', '/admin/login', '/admin/news/edit/example', '/admin/assets/missing.js', '/missing-page', '/api/unknown']) {
    let shell = false;
    const request = new Request('https://example.invalid' + route);
    const response = await handle({ request, env: { ASSETS: { fetch: async req => { shell = true; assert.equal(new URL(req.url).pathname, '/admin/'); return new Response('ADMIN'); } } }, next: async () => new Response('not found', { status: 404 }) });
    const expectedShell = route.startsWith('/admin') && !route.includes('.js');
    assert.equal(shell, expectedShell, route);
    assert.equal(response.status, expectedShell ? 200 : 404, route);
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
    if (route.startsWith('/admin')) assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  }
});

test('local HTTP preview does not enable HSTS', async () => {
  const response = await handle({ request: new Request('http://localhost/'), env: {}, next: async () => new Response('OK') });
  assert.equal(response.headers.has('Strict-Transport-Security'), false);
});
