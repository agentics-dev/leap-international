// functions/webhooks/stripe.js
// Stripe Webhook — 验签 + 处理 payment_intent.succeeded（支付宝/微信等异步支付用）。
// Cloudflare Pages Function：路由 POST /webhooks/stripe
//
// 用 Web Crypto API 验签（Cloudflare Workers 无 Node crypto 模块）。

const { json, sendPaymentEmails } = require('../_stripe-shared');

// Stripe-Signature header 格式：t=时间戳,v1=签名[,v0=...]
function parseSignature(header) {
  const parts = {};
  if (!header) return parts;
  for (const item of header.split(',')) {
    const [k, v] = item.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  }
  return parts;
}

// 用 HMAC-SHA256 验证 Stripe 签名
async function verifySignature(payload, sigHeader, secret) {
  const parts = parseSignature(sigHeader);
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    throw new Error('Missing t or v1 in signature header');
  }

  // 防重放：拒绝 5 分钟前的请求
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) {
    throw new Error('Timestamp too old');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSig)));

  // 时间安全比较
  if (expectedB64.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= expectedB64.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
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

  // 4. 处理 payment_intent.succeeded
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const meta = pi.metadata || {};
    const amount = pi.amount_received ? pi.amount_received / 100 : (pi.amount / 100);
    const currency = (pi.currency || 'hkd').toUpperCase();

    let method = 'Card';
    const pmTypes = pi.payment_method_types || [];
    if (pmTypes.includes('alipay')) method = 'Alipay 支付宝';
    else if (pmTypes.includes('wechat_pay')) method = 'WeChat Pay 微信支付';

    // 从 metadata 取客户信息发邮件（异步支付只能靠 webhook 发）
    await sendPaymentEmails({
      env,
      amount,
      currency,
      customerName: meta.customer_name || '',
      customerEmail: meta.customer_email || '',
      method,
      paymentId: pi.id,
      status: 'SUCCEEDED',
      locale: meta.locale || 'en',
    });

    console.log(`Webhook processed: ${pi.id} - ${currency} ${amount}`);
  } else {
    // 其他事件类型，记录但不处理
    console.log(`Webhook received (unhandled type): ${event.type}`);
  }

  // 5. 必须快速返回 200，否则 Stripe 会重试
  return json(200, { received: true });
}
