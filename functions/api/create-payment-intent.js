// functions/api/create-payment-intent.js
// CyberSource Unified Checkout — 生成 captureContext。
// Cloudflare Pages Function：路由 POST /api/create-payment-intent

const { cybsRequest } = require('../_cybs-auth');
const { validateOrder } = require('../_order-validation');

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolveSiteOrigin(request) {
  const url = new URL(request.url);
  return url.origin; // Pages Functions 里 request.url 含完整 origin
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.CYBS_MERCHANT_ID || !env.CYBS_API_KEY || !env.CYBS_SECRET_KEY) {
    return json(500, { error: 'CyberSource credentials not configured' });
  }

  try {
    const body = await request.json();
    const {
      amount,
      currency,
      customer_name,
      customer_email,
      line_items,
      discount_code,
      discount_amount,
      locale,
    } = body;

    if (!amount || !currency) return json(400, { error: 'Missing amount or currency' });

    const validation = validateOrder({ amount, currency, line_items, discount_code, discount_amount });
    if (!validation.valid) return json(400, { error: validation.reason });

    const siteOrigin = resolveSiteOrigin(request);
    const safeOrigin = siteOrigin.replace(/^http:/, 'https:').replace(/\/$/, '');

    const captureContextRequest = {
      clientVersion: '0.26',
      targetOrigins: [safeOrigin],
      allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'JCB', 'DISCOVER', 'CUP'],
      allowedPaymentTypes: ['PANENTRY'],
      country: 'HK',
      locale: locale === 'zh' ? 'zh_HK' : 'en_US',
      completeMandate: { type: 'AUTH', decisionManager: true },
      orderInformation: {
        amountDetails: {
          totalAmount: String(amount) + '.00',
          currency: currency || 'HKD',
        },
      },
    };

    const r = await cybsRequest({
      method: 'POST',
      path: '/up/v1/capture-contexts',
      body: captureContextRequest,
      env,
    });

    if (!r.ok) {
      console.error('CyberSource Sessions failed:', r.status, JSON.stringify(r.data).slice(0, 300));
      return json(r.status, { error: 'CyberSource Sessions API failed', detail: r.data });
    }

    // r.data 是 captureContext JWT 字符串
    const captureContext = typeof r.data === 'string' ? r.data : r.data.captureContext || r.data;

    return json(200, {
      captureContext,
      amount,
      currency: currency || 'HKD',
      customer_name: customer_name || '',
      customer_email: customer_email || '',
      line_items: validation.products,
      subtotal: validation.subtotal,
      discount_code: discount_code || '',
      discount_amount: validation.discountAmount,
      locale: locale || 'en',
    });
  } catch (error) {
    console.error('create-payment-intent error:', error);
    return json(500, { error: error.message });
  }
}
