const { json } = require('../_stripe-shared');
const { signReceipt } = require('../_receipt-token');

function paymentMethodDescription(paymentIntent) {
  const paymentMethod = paymentIntent.payment_method;
  if (paymentMethod && typeof paymentMethod === 'object') {
    if (paymentMethod.type === 'card' && paymentMethod.card) {
      return `${paymentMethod.card.brand || 'Card'} ****${paymentMethod.card.last4 || ''}`.trim();
    }
    if (paymentMethod.type === 'alipay') return 'Alipay';
    if (paymentMethod.type === 'wechat_pay') return 'WeChat Pay';
    return paymentMethod.type || 'Online payment';
  }
  return 'Online payment';
}

function publicStatus(status) {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'processing') return 'processing';
  if (status === 'requires_action' || status === 'requires_confirmation') return 'requires_action';
  if (status === 'requires_payment_method' || status === 'canceled') return 'failed';
  return 'pending';
}

function secretsMatch(expected, candidate) {
  if (typeof expected !== 'string' || typeof candidate !== 'string' || expected.length !== candidate.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
  return difference === 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.STRIPE_SECRET_KEY) return json(503, { error: 'Stripe payment is not configured' });

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }
  const paymentId = String(body.payment_intent_id || '');
  const clientSecret = String(body.payment_intent_client_secret || '');
  if (!/^pi_[A-Za-z0-9_]+$/.test(paymentId)) return json(400, { error: 'Invalid payment ID' });
  if (!clientSecret.startsWith(`${paymentId}_secret_`)) return json(400, { error: 'Missing payment verification secret' });

  try {
    const query = new URLSearchParams({ 'expand[]': 'payment_method' });
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentId)}?${query}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const data = await response.json();
    if (!response.ok) return json(response.status, { error: 'Unable to verify payment' });
    if (!secretsMatch(data.client_secret, clientSecret)) return json(403, { error: 'Payment verification failed' });

    const status = publicStatus(data.status);
    const amount = (data.amount_received || data.amount || 0) / 100;
    const currency = String(data.currency || 'hkd').toUpperCase();
    const metadata = data.metadata || {};
    const method = paymentMethodDescription(data);

    // 微信支付等待扫码时，把二维码透传给前端展示（data URL 图片 + 官方说明页）
    let qrImageUrl = null;
    let qrHostedUrl = null;
    let qrExpiresAt = null;
    if (status === 'requires_action' && data.next_action) {
      const qr = data.next_action.wechat_pay_display_qr_code;
      if (qr && typeof qr === 'object') {
        const image = String(qr.image_data_url || qr.qr_code || qr.data_url || '');
        if (image.startsWith('data:image/')) qrImageUrl = image.slice(0, 200000);
        const hosted = String(qr.hosted_instructions_url || '');
        if (/^https:\/\//.test(hosted)) qrHostedUrl = hosted;
        if (Number.isFinite(qr.expires_at)) qrExpiresAt = qr.expires_at;
      }
    }

    let receiptToken = null;
    if (status === 'succeeded') {
      if (!env.PAYMENT_RECEIPT_SECRET) return json(503, { error: 'Payment succeeded but receipt service is unavailable' });
      receiptToken = await signReceipt({
        type: 'payment_receipt',
        gateway: 'stripe',
        paymentId: data.id,
        status,
        amount,
        currency,
        method,
        customerName: metadata.customer_name || '',
        customerEmail: metadata.customer_email || '',
      }, env.PAYMENT_RECEIPT_SECRET);
    }

    return json(200, {
      status,
      succeeded: status === 'succeeded',
      payment_id: data.id,
      amount,
      currency,
      method,
      receipt_token: receiptToken,
      failure_message: data.last_payment_error && data.last_payment_error.message || null,
      qr_image_url: qrImageUrl,
      qr_hosted_url: qrHostedUrl,
      qr_expires_at: qrExpiresAt,
    });
  } catch (error) {
    console.error('confirm-stripe-payment error:', error.message);
    return json(502, { error: 'Unable to query Stripe' });
  }
}
