const test = require('node:test');
const assert = require('node:assert/strict');
const adapt = require('../functions/_content-adapter');

const names = ['news', 'news-detail', 'faqs', 'authors', 'case-studies', 'comparisons'];
test('content routes preserve JSON and use request-scoped configuration', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, key: options.headers.apikey });
    return Response.json([{ id: 'fixture', slug: 'fixture' }], { headers: { 'content-range': '0-0/1' } });
  });
  for (const name of names) {
    const handle = adapt(require('../api/' + name));
    const contexts = ['one', 'two'].map(tenant => ({
      request: new Request('https://example.invalid/api/' + name + '?id=fixture'),
      env: { SUPABASE_URL: 'https://' + tenant + '.example.invalid', SUPABASE_ANON_KEY: tenant },
    }));
    const responses = await Promise.all(contexts.map(handle));
    for (const response of responses) {
      assert.equal(response.status, 200, name);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.doesNotMatch(await response.text(), /<html/);
    }
    assert.equal((await handle({ ...contexts[0], request: new Request(contexts[0].request.url, { method: 'POST' }) })).status, 405);
    assert.equal((await handle({ ...contexts[0], env: {} })).status, 503);
  }
  assert.equal(calls.length, names.length * 2);
  for (const call of calls) assert.equal(new URL(call.url).hostname.split('.')[0], call.key);
});

test('upstream failure is a JSON error, never a successful HTML fallback', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  const response = await adapt(require('../api/news'))({
    request: new Request('https://example.invalid/api/news'),
    env: { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'synthetic' },
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'Failed to fetch News');
});
