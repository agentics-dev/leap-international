const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./helpers/site-page.cjs');
const { submitEnquiry } = require('../functions/_enquiry');

const files = ['index.html', ...fs.readdirSync('pages').filter(name => name.endsWith('.html')).map(name => 'pages/' + name)];
const enquiryPages = files.filter(file => fs.readFileSync(file, 'utf8').includes('/js/enquiry.js'));

function fillEnquiry(window) {
  const form = window.document.querySelector('#contactForm, #enquireForm, #enquireModal form');
  for (const field of form.querySelectorAll('input, textarea')) {
    if (field.name === 'website') continue;
    field.value = /email/i.test(field.id) ? 'local-check@example.com' : /phone/i.test(field.id) ? '5550100' : 'Local interaction check';
  }
  const service = form.querySelector('#serviceInput');
  if (service) service.value = 'accounting-tax';
  return form;
}

test('every public inline button handler resolves, and form field IDs are unique', async () => {
  for (const lang of ['en', 'zh-Hant', 'zh-Hans']) {
    for (const file of files) {
      const { dom, errors } = await load(file, lang);
      try {
        const w = dom.window;
        w.HTMLElement.prototype.scrollIntoView = function () {};
        w.alert = function () {};
        w.history.back = function () {};
        w.open = function () {};
        assert.deepEqual(errors, [], file);
        const ids = [...w.document.querySelectorAll('[id]')].map(node => node.id);
        assert.equal(new Set(ids).size, ids.length, file + ': duplicate IDs');
        for (const node of w.document.querySelectorAll('[onclick]')) {
          const handler = node.getAttribute('onclick');
          if (/submit|confirmOrder|startCSCheckout/.test(handler)) continue;
          assert.doesNotThrow(() => w.Function('event', handler).call(node, new w.Event('click')), file + ': ' + handler);
        }
        for (const button of w.document.querySelectorAll('.faq-btn')) {
          const content = button.nextElementSibling;
          const before = content.classList.contains('open');
          button.click();
          assert.notEqual(content.classList.contains('open'), before, file + ': FAQ opens');
          button.click();
          assert.equal(content.classList.contains('open'), before, file + ': FAQ closes');
        }
      } finally { dom.window.close(); }
    }
  }
});

test('all enquiry forms preserve input on failure, retry once, and report actual acceptance in each language', async () => {
  for (const lang of ['en', 'zh-Hant', 'zh-Hans']) {
    for (const file of enquiryPages) {
      let accept = false;
      const requests = [];
      const { dom } = await load(file, lang, { fetch: async (url, options) => {
        if (url !== '/api/enquiry') return Response.json({}, { status: 503 });
        requests.push(JSON.parse(options.body));
        return Response.json(accept ? { success: true } : { error: 'Unavailable' }, { status: accept ? 200 : 503 });
      }});
      try {
        const form = fillEnquiry(dom.window);
        await dom.window.submitLeapEnquiry(form);
        assert.equal(form.querySelector('[data-enquiry-status]').dataset.statusKey, 'failed', file);
        assert.equal(form.querySelector('input[type="email"]').value, 'local-check@example.com', file);
        accept = true;
        await Promise.all([dom.window.submitLeapEnquiry(form), dom.window.submitLeapEnquiry(form)]);
        assert.equal(requests.length, 2, file + ': duplicate request suppressed');
        assert.equal(requests[0].requestId, requests[1].requestId, file + ': retry keeps idempotency key');
        assert.equal(form.querySelector('[data-enquiry-status]').dataset.statusKey, 'success', file);
        assert.equal(form.querySelector('button[type="submit"]').disabled, false, file);
      } finally { dom.window.close(); }
    }
  }
});

test('enquiry backend only reports success after delivery provider accepts, and escapes user content', async () => {
  const body = { name: '<script>test</script>', email: 'local-check@example.com', message: 'Consultation request', requestId: '00000000-0000-4000-8000-000000000001' };
  assert.equal((await submitEnquiry(body, {})).status, 503);
  assert.equal((await submitEnquiry({ ...body, email: 'invalid' }, {})).status, 400);
  const originalFetch = global.fetch;
  const env = { RESEND_API_KEY: 'test-only', NOTIFY_EMAIL: 'recipient@example.com' };
  try {
    global.fetch = async (_url, options) => {
      const email = JSON.parse(options.body);
      assert.equal(email.to[0], env.NOTIFY_EMAIL);
      assert.ok(email.html.includes('&lt;script&gt;'));
      assert.equal(options.headers['Idempotency-Key'], 'enquiry-' + body.requestId);
      return Response.json({ id: 'mock-only' });
    };
    assert.deepEqual(await submitEnquiry(body, env), { status: 200, body: { success: true } });
    global.fetch = async () => Response.json({ error: 'Unavailable' }, { status: 503 });
    assert.equal((await submitEnquiry(body, env)).status, 502);
  } finally { global.fetch = originalFetch; }
});

test('booking passes the selected date and Beijing time into the enquiry', async () => {
  for (const file of ['index.html', 'pages/select-checkout-option.html']) {
    const { dom } = await load(file, 'en');
    try {
      const w = dom.window;
      w.openBookingModal();
      w.selectDate(2026, 11, 8);
      w.pickSlot(14, 15);
      w.confirmBooking();
      assert.match(w.document.getElementById('enqMessage').value, /2026-12-08 14:15 \(UTC\+8\)/);
      assert.ok(w.document.getElementById('enquireModal').classList.contains('show'));
    } finally { dom.window.close(); }
  }
});

test('secretary setup restores the selected premium plan and shareholder count', async () => {
  const { dom } = await load('pages/cs-shareholders-plan.html', 'en');
  try {
    const w = dom.window;
    assert.match(w.document.querySelector('.plan-card.selected').textContent, /Premium/);
    assert.equal(w.document.getElementById('shareholderInput').value, '4');
    w.goNext();
    const order = JSON.parse(w.localStorage.getItem('leap-package-cs'));
    assert.equal(order.csPlan, 'premium');
    assert.equal(order.csShareholders, 4);
    assert.equal(order.csPrice, 4200);
  } finally { dom.window.close(); }
});

test('shareholder controls enforce the same supported range as checkout', async () => {
  for (const file of ['pages/corporate-secretary.html', 'pages/cs-shareholders-plan.html', 'pages/select-shareholders.html']) {
    const { dom } = await load(file, 'en');
    try {
      const parse = dom.window.csParseCount || dom.window.parseShareholderCount;
      assert.equal(parse('50'), 50);
      for (const value of ['51', '0', '-1', '2.5', '']) assert.equal(parse(value), null, file + ': ' + value);
    } finally { dom.window.close(); }
  }
});


test('news pagination retries the failed page without skipping or duplicating items', async () => {
  const { fixture } = require('./helpers/site-page.cjs');
  const requested = [];
  let fail = false;
  const { dom } = await load('pages/news.html', 'en', { fetch: async url => {
    requested.push(url);
    return fail ? Response.json({}, { status: 503 }) : Response.json({ data: [fixture], count: 27 });
  }});
  try {
    const w = dom.window;
    fail = true;
    await w.loadNews();
    assert.equal(w.document.getElementById('load-more-container').classList.contains('hidden'), false);
    assert.equal(w.document.getElementById('news-error').classList.contains('hidden'), false);
    fail = false;
    await Promise.all([w.loadNews(), w.loadNews()]);
    assert.deepEqual(requested, ['/api/news?page=0&pageSize=9', '/api/news?page=1&pageSize=9', '/api/news?page=1&pageSize=9']);
    assert.equal(w.document.getElementById('news-container').children.length, 2);
    assert.equal(w.document.getElementById('news-error').classList.contains('hidden'), true);
    await w.loadNews();
    assert.equal(w.document.getElementById('load-more-container').classList.contains('hidden'), true);
  } finally { dom.window.close(); }
});
