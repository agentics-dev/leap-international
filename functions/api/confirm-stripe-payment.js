// functions/api/confirm-stripe-payment.js
// Stripe — 查询 PaymentIntent 状态，成功则发邮件（卡支付用，同步确认）。
// Cloudflare Pages Function：路由 POST /api/confirm-stripe-payment

const { json, sendPaymentEmails } = require('../_stripe-shared');

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return json(500, { error: 'Stripe not configured' });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const {
    payment_intent_id,
    customer_name,
    customer_email,
    discount_code,
    discount_amount,
    locale,
  } = body;

  if (!payment_intent_id) {
    return json(400, { error: 'Missing payment_intent_id' });
  }

  // 1. 查询 PaymentIntent 状态
  let data;
  try {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(payment_intent_id)}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    data = await res.json();
    if (!res.ok) {
      console.error('Stripe retrieve error:', JSON.stringify(data));
      return json(res.status, { error: 'Failed to retrieve payment', detail: data.error });
    }
  } catch (e) {
    console.error('confirm-stripe-payment error:', e);
    return json(500, { error: 'Failed to query payment', detail: e.message });
  }

  // 2. 检查支付状态
  const status = data.status;
  if (status !== 'succeeded') {
    return json(200, {
      status,
      succeeded: false,
      message: `Payment status: ${status}`,
    });
  }

  // 3. 支付成功 → 发邮件
  const amount = data.amount_received ? data.amount_received / 100 : (data.amount / 100);
  const currency = (data.currency || 'hkd').toUpperCase();
  const paymentId = data.id;

  // 优先用 PaymentIntent 的 metadata（创建时存的，可信），客户端传入的仅作 fallback
  const meta = data.metadata || {};
  const finalName = meta.customer_name || customer_name || '';
  const finalEmail = meta.customer_email || customer_email || '';
  const finalLocale = meta.locale || locale || 'en';

  // 提取支付方式描述
  let method = 'Card';
  const pmTypes = data.payment_method_types || [];
  if (pmTypes.includes('alipay')) method = 'Alipay 支付宝';
  else if (pmTypes.includes('wechat_pay')) method = 'WeChat Pay 微信支付';
  else if (data.charges && data.charges.data[0]) {
    const card = data.charges.data[0].payment_method_details;
    if (card && card.card) method = `${card.card.brand} ****${card.card.last4}`;
  }

  await sendPaymentEmails({
    env,
    amount,
    currency,
    customerName: finalName,
    customerEmail: finalEmail,
    method,
    paymentId,
    status: 'SUCCEEDED',
    locale: finalLocale,
  });

  return json(200, {
    status: 'succeeded',
    succeeded: true,
    payment_id: paymentId,
    amount,
    currency,
    method,
  });
}
