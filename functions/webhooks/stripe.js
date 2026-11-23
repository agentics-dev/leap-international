// functions/webhooks/stripe.js
// Stripe Webhook — 验签 + 处理 payment_intent.succeeded（支付宝/微信等异步支付用）。
// Cloudflare Pages Function：路由 POST /webhooks/stripe
//
// 用 Web Crypto API 验签（Cloudflare Workers 无 Node crypto 模块）。

const { json, sendPaymentEmails, sendResendEmail, toStripeAmount } = require('../_stripe-shared');

// Stripe-Signature header 格式：t=时间戳,v1=签名[,v0=...]
function parseSignature(header) {
  const parts = {};
  if (!header) return parts;
  for (const item of header.split(',')) {
    const [k, v] = item.split('=');
    if (k && v) {
      const key = k.trim();
      if (!parts[key]) parts[key] = [];
      parts[key].push(v.trim());
    }
  }
  return parts;
}

// 用 HMAC-SHA256 验证 Stripe 签名
async function verifySignature(payload, sigHeader, secret) {
  const parts = parseSignature(sigHeader);
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) {
    throw new Error('Missing t or v1 in signature header');
  }

  // 防重放：拒绝 5 分钟前的请求
  const parsedTimestamp = Number.parseInt(timestamp, 10);
  const age = Math.abs(Math.floor(Date.now() / 1000) - parsedTimestamp);
  if (!Number.isInteger(parsedTimestamp) || age > 300) {
    throw new Error('Timestamp outside tolerance');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload)));
  const expectedHex = Array.from(expectedBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return signatures.some((signature) => {
    const candidate = signature.toLowerCase();
    if (expectedHex.length !== candidate.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) diff |= expectedHex.charCodeAt(i) ^ candidate.charCodeAt(i);
    return diff === 0;
  });
}

// Resend retains idempotency keys for 24 hours. Leave a margin for slow requests.
const RESEND_RETRY_WINDOW_SECONDS = 23 * 60 * 60;

async function stripeIntent(env, paymentId, metadata, idempotencyKey) {
  const endpoint = `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentId)}`;
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  const options = { headers, signal: AbortSignal.timeout(8000) };
  let url = endpoint;
  if (metadata) {
    options.method = 'POST';
    options.body = new URLSearchParams(Object.entries(metadata).map(([key, value]) => [`metadata[${key}]`, value]));
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  } else {
    url += '?' + new URLSearchParams({ 'expand[]': 'latest_charge' });
  }

  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Stripe PaymentIntent HTTP ${response.status}`);
  return response.json();
}

async function deliverOnce(env, intent, recipient, message, eventTime) {
  const field = `leap_email_${recipient}`;
  const state = intent.metadata[field];
  if (state?.startsWith('sent:')) return;

  const now = Math.floor(Date.now() / 1000);
  // Legacy payments could already have been handled by a webhook that kept no marker.
  if (!intent.metadata.leap_order && (!Number.isInteger(eventTime) || now - eventTime >= RESEND_RETRY_WINDOW_SECONDS)) {
    throw new Error('Legacy payment notification requires manual reconciliation');
  }

  let started = state;
  if (!started) {
    const saved = await stripeIntent(env, intent.id, { [field]: String(now) }, `leap-${intent.id}-${recipient}-start`);
    started = saved.metadata?.[field];
  }

  const attemptTime = Number(started);
  const elapsed = Math.floor(Date.now() / 1000) - attemptTime;
  if (!Number.isSafeInteger(attemptTime) || elapsed < 0 || elapsed >= RESEND_RETRY_WINDOW_SECONDS) {
    throw new Error('Payment notification requires manual reconciliation');
  }

  const accepted = await sendResendEmail(message);
  if (typeof accepted?.id !== 'string' || !accepted.id) throw new Error('Resend did not return a message ID');
  await stripeIntent(env, intent.id, { [field]: `sent:${accepted.id}` });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return json(500, { error: 'Webhook not configured' });
  }

  // 1. 读取原始 body（验签需要原始字符串）
  const payload = await request.text();
  const sigHeader = request.headers.get('Stripe-Signature');

  // 2. 验签
  let verified;
  try {
    verified = await verifySignature(payload, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return json(400, { error: 'Invalid signature' });
  }
  if (!verified) {
    console.error('Webhook signature mismatch');
    return json(400, { error: 'Signature mismatch' });
  }

  // 3. 解析事件
  let event;
  try {
    event = JSON.parse(payload);
  } catch (e) {
    return json(400, { error: 'Invalid JSON' });
  }

  if (event?.type !== 'payment_intent.succeeded') return json(200, { received: true });
  const paymentId = event.data?.object?.id;
  if (typeof paymentId !== 'string' || !/^pi_[A-Za-z0-9_]+$/.test(paymentId)) {
    return json(400, { error: 'Invalid PaymentIntent' });
  }

  try {
    const intent = await stripeIntent(env, paymentId);
    const meta = intent.metadata || {};
    if (meta.gateway !== 'stripe' || !meta.order_flow) return json(200, { received: true });
    const received = intent.amount_received;
    const currencyMatches = meta.order_currency
      ? intent.currency === meta.order_currency : ['usd', 'hkd'].includes(intent.currency);
    if (intent.id !== paymentId || intent.status !== 'succeeded' || !currencyMatches ||
        !Number.isSafeInteger(received) || received < 1 || received !== toStripeAmount(meta.order_total)) {
      throw new Error('Stripe payment does not match the order');
    }

    const charge = intent.latest_charge;
    const type = charge?.payment_method_details?.type;
    const method = type === 'alipay' ? 'Alipay 支付宝' : type === 'wechat_pay' ? 'WeChat Pay 微信支付' : type || 'Online payment';
    await sendPaymentEmails({
      env,
      amount: received / 100,
      currency: intent.currency.toUpperCase(),
      customerName: meta.customer_name || '',
      customerEmail: meta.customer_email || '',
      method,
      paymentId,
      status: 'SUCCEEDED',
      locale: meta.locale || 'en',
      gateway: 'Stripe',
      paymentTime: charge?.created || intent.created,
    }, (recipient, message) => deliverOnce(env, intent, recipient, message, event.created));

    return json(200, { received: true });
  } catch (error) {
    console.error('Stripe payment requires follow-up:', paymentId, error.message);
    return json(503, { error: 'Payment notification could not be completed' });
  }
}
