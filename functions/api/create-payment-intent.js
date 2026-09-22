const { cybsRequest } = require('../_cybs-auth');
const { quoteOrder } = require('../_order-validation');
const { json } = require('../_stripe-shared');
const { signReceipt } = require('../_receipt-token');

function normalizeCustomer(customer) {
  const name = String(customer && customer.name || '').trim().slice(0, 120);
  const email = String(customer && customer.email || '').trim().toLowerCase().slice(0, 254);
  if (!name) return { valid: false, error: 'Customer name is required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: 'A valid customer email is required' };
  return { valid: true, name, email };
}

function safeTargetOrigin(request, env) {
  const raw = env.SITE_URL || new URL(request.url).origin;
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('SITE_URL must use HTTPS');
  }
  return url.origin;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (String(env.PAYMENT_GATEWAY || 'stripe').toLowerCase() !== 'cybersource') {
    return json(409, { error: 'CyberSource is not the active payment gateway' });
  }
  if (!env.CYBS_MERCHANT_ID || !env.CYBS_API_KEY || !env.CYBS_SECRET_KEY) {
    return json(503, { error: 'CyberSource payment is not configured' });
  }
  if (!env.PAYMENT_RECEIPT_SECRET) return json(503, { error: 'Payment verification is not configured' });

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }
  const quote = quoteOrder(body.order, body.discount_code, env);
  if (!quote.valid) return json(400, { error: quote.reason, code: quote.code });
  const customer = normalizeCustomer(body.customer);
  if (!customer.valid) return json(400, { error: customer.error });

  try {
    const locale = String(body.locale || 'en');
    const captureContextRequest = {
      targetOrigins: [safeTargetOrigin(request, env)],
      country: 'HK',
      locale: (locale === 'zh' || locale === 'zh-Hant') ? 'zh_HK' : locale === 'zh-Hans' ? 'zh_CN' : 'en_US',
      completeMandate: { type: 'CAPTURE', consumerAuthentication: '3DS', decisionManager: true },
      data: {
        orderInformation: {
          amountDetails: { totalAmount: `${quote.total}.00`, currency: quote.currency },
        },
      },
    };
    const response = await cybsRequest({ method: 'POST', path: '/uc/v1/sessions', body: captureContextRequest, env });
    if (!response.ok) {
      console.error('CyberSource Sessions failed:', response.status);
      return json(response.status, { error: 'Unable to start CyberSource payment' });
    }
    const captureContext = typeof response.data === 'string'
      ? response.data
      : response.data.captureContext || response.data;
    const checkoutToken = await signReceipt({
      type: 'checkout_context',
      gateway: 'cybersource',
      order: quote.order,
      discountCode: quote.discountCode,
      amount: quote.total,
      currency: quote.currency,
      customer: { name: customer.name, email: customer.email },
    }, env.PAYMENT_RECEIPT_SECRET);
    return json(200, { captureContext, checkout_token: checkoutToken, quote });
  } catch (error) {
    console.error('create-payment-intent error:', error.message);
    return json(502, { error: 'Unable to reach CyberSource' });
  }
}
