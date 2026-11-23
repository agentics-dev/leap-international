const assert = require('node:assert/strict');
const { createHmac, generateKeyPairSync, sign } = require('node:crypto');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { load, fixture } = require('./helpers/site-page.cjs');
const { verifyReceipt } = require('../functions/_receipt-token');

function loadHandler(relativePath) {
  const file = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(file, 'utf8').replace('export async function onRequestPost', 'async function onRequestPost');
  return vm.runInThisContext(`(require) => { ${source}\nreturn onRequestPost; }`, { filename: file })(createRequire(file));
}

test('news detail strips active markup and preserves article formatting in all languages', async () => {
  const article = '<p><strong>Article</strong><a href="/pages/contact.html">Contact</a>' +
    '<img src="/images/article.png" alt="Cover" onerror="alert(1)"></p>' +
    '<base href="https://example.invalid/"><a href="java&#x09;script:alert(1)">Unsafe</a>' +
    '<svg><a xlink:href="javascript:alert(1)"><text>Unsafe</text></a>' +
    '<animate attributeName="href" values="javascript:alert(1)"/></svg>' +
    '<math><mtext><img src="/invalid" onerror="alert(1)"></mtext></math>';
  const { dom, errors } = await load('pages/news-detail.html', 'en', {
    fetch: async () => Response.json({ ...fixture, content_en: article, content_zh: article }),
  });
  try {
    assert.deepEqual(errors, []);
    for (const language of ['en', 'zh', 'zh-Hans']) {
      const body = dom.window.document.querySelector(`#article-content .lang-${language}`);
      assert.equal(body.querySelector('strong').textContent, 'Article');
      assert.equal(body.querySelector('a[href]').getAttribute('href'), '/pages/contact.html');
      assert.equal(body.querySelector('img').getAttribute('alt'), 'Cover');
      assert.equal(body.querySelector('svg, math, base, [onerror], [href^="java"], [src="/invalid"]'), null);
    }
  } finally {
    dom.window.close();
  }
});

test('Stripe retries failed notifications and skips accepted messages on duplicate events', async t => {
  const handle = loadHandler('functions/webhooks/stripe.js');
  const env = {
    STRIPE_SECRET_KEY: 'synthetic', STRIPE_WEBHOOK_SECRET: 'synthetic-signing-secret',
    RESEND_API_KEY: 'synthetic', NOTIFY_EMAIL: 'business@example.invalid',
  };
  const intent = {
    id: 'pi_audit', status: 'succeeded', amount_received: 650000, currency: 'usd', created: 1000,
    metadata: { gateway: 'stripe', order_flow: 'incorporation', order_total: '6500', customer_email: 'customer@example.invalid' },
  };
  const attempts = [];
  let businessUnavailable = true;
  let businessMarkerUnavailable = true;
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith('https://api.stripe.com/v1/payment_intents/pi_audit')) {
      if (options.method === 'POST') {
        for (const [key, value] of options.body) {
          if (key === 'metadata[leap_email_business]' && value.startsWith('sent:') && businessMarkerUnavailable) {
            businessMarkerUnavailable = false;
            return Response.json({}, { status: 503 });
          }
          intent.metadata[key.slice(9, -1)] = value;
        }
      }
      return Response.json(intent);
    }
    assert.equal(url, 'https://api.resend.com/emails');
    const { to } = JSON.parse(options.body);
    attempts.push({ key: options.headers['Idempotency-Key'], body: options.body });
    if (businessUnavailable && to[0] === env.NOTIFY_EMAIL) return Response.json({}, { status: 503 });
    return Response.json({ id: to[0] === env.NOTIFY_EMAIL ? 'business-message' : 'customer-message' });
  });

  function post(eventId, valid = true, created = Math.floor(Date.now() / 1000)) {
    const body = JSON.stringify({ id: eventId, created, type: 'payment_intent.succeeded', data: { object: { id: intent.id } } });
    const now = Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${now}.${body}`).digest('hex');
    const request = new Request('https://example.invalid/webhooks/stripe', {
      method: 'POST', body, headers: { 'Stripe-Signature': `t=${now},v1=${valid ? digest : 'bad'}` },
    });
    return handle({ request, env });
  }

  assert.equal((await post('evt_1', false)).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await post('evt_1')).status, 503);
  assert.equal(intent.metadata.leap_email_customer, 'sent:customer-message');
  assert.match(intent.metadata.leap_email_business, /^\d+$/);
  businessUnavailable = false;
  assert.equal((await post('evt_1')).status, 503);
  assert.match(intent.metadata.leap_email_business, /^\d+$/);
  assert.equal((await post('evt_1')).status, 200);
  assert.equal(intent.metadata.leap_email_business, 'sent:business-message');
  assert.equal((await post('evt_2')).status, 200);
  assert.equal(attempts.length, 4);
  const business = attempts.filter(attempt => attempt.key.endsWith('-business'));
  assert.deepEqual(business[0], business[1]);
  assert.deepEqual(business[1], business[2]);

  intent.metadata.leap_email_business = String(Math.floor(Date.now() / 1000) - 24 * 60 * 60);
  assert.equal((await post('evt_3')).status, 503);
  assert.equal(attempts.length, 4);

  delete intent.metadata.leap_email_business;
  const yesterday = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  assert.equal((await post('evt_4', true, yesterday)).status, 503);
  assert.equal(attempts.length, 4);
  intent.currency = 'hkd';
  assert.equal((await post('evt_5')).status, 200);
  assert.equal(attempts.length, 5);
});

test('CyberSource result must be current and tied to the checkout that created it', async t => {
  const createCheckout = loadHandler('functions/api/create-payment-intent.js');
  const processPayment = loadHandler('functions/api/process-payment.js');
  const env = {
    PAYMENT_GATEWAY: 'cybersource', PAYMENT_RECEIPT_SECRET: 'synthetic-receipt-secret-for-audit-test',
    CYBS_MERCHANT_ID: 'test-merchant', CYBS_API_KEY: 'synthetic', CYBS_SECRET_KEY: 'c3ludGhldGlj',
    RESEND_API_KEY: 'synthetic', NOTIFY_EMAIL: 'business@example.invalid',
  };
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const references = [];
  const sent = new Set();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/uc/v1/sessions')) {
      references.push(JSON.parse(options.body).data.clientReferenceInformation.code);
      return Response.json({ captureContext: 'synthetic-context' });
    }
    if (url.endsWith('/flex/v2/public-keys/test-key')) return Response.json(publicKey.export({ format: 'jwk' }));
    assert.equal(url, 'https://api.resend.com/emails');
    sent.add(options.headers['Idempotency-Key']);
    return Response.json({ id: 'synthetic-email' });
  });
  const order = { flow: 'incorporation', incorporation: { residency: 'local', plan: 'starter' } };
  const post = (handler, body, overrides) => handler({
    request: new Request('https://example.invalid', { method: 'POST', body: JSON.stringify(body) }),
    env: { ...env, ...overrides },
  });
  async function checkout(name) {
    const response = await post(createCheckout, { order, customer: { name, email: 'audit@example.invalid' } });
    assert.equal(response.status, 200);
    return (await response.json()).checkout_token;
  }
  const a = await checkout('Audit A');
  const b = await checkout('Audit B');
  assert.notEqual(references[0], references[1]);
  assert.equal((await verifyReceipt(a, env.PAYMENT_RECEIPT_SECRET)).reference, references[0]);
  const now = Math.floor(Date.now() / 1000);
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  function result(reference, exp) {
    const payload = {
      id: '1234567890', status: 'AUTHORIZED', exp,
      details: { clientReferenceInformation: { code: reference }, orderInformation: { amountDetails: { totalAmount: '6500.00', currency: 'USD' } } },
    };
    const input = b64({ alg: 'RS256', kid: 'test-key' }) + '.' + b64(payload);
    return input + '.' + sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  }
  const completeResponse = result(references[0], now + 60);
  assert.equal((await post(processPayment, { completeResponse, checkout_token: b })).status, 400);
  assert.equal((await post(processPayment, { completeResponse: result(references[0], now - 1), checkout_token: a })).status, 400);
  assert.equal((await post(processPayment, { completeResponse, checkout_token: a }, { PAYMENT_GATEWAY: 'stripe' })).status, 409);
  assert.equal(sent.size, 0);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await post(processPayment, { completeResponse, checkout_token: a });
    assert.equal(response.status, 200);
    const receipt = await verifyReceipt((await response.json()).receipt_token, env.PAYMENT_RECEIPT_SECRET);
    assert.equal(receipt.customerName, 'Audit A');
    assert.equal(receipt.paymentId, '1234567890');
  }
  assert.equal(sent.size, 2);
});
