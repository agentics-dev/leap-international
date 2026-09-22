const { json } = require('../_stripe-shared');

export async function onRequestGet(context) {
  const { env } = context;
  const gateway = String(env.PAYMENT_GATEWAY || 'stripe').trim().toLowerCase();

  if (gateway === 'stripe') {
    const available = Boolean(env.STRIPE_PUBLISHABLE_KEY && env.STRIPE_SECRET_KEY && env.PAYMENT_RECEIPT_SECRET);
    return json(200, {
      gateway,
      available,
      enabledMethods: available ? ['card', 'apple_pay', 'alipay', 'wechat_pay'] : [],
      stripePublishableKey: available ? env.STRIPE_PUBLISHABLE_KEY : null,
      message: available ? null : 'Stripe payment is not configured',
    });
  }
  if (gateway === 'cybersource') {
    const available = Boolean(env.CYBS_MERCHANT_ID && env.CYBS_API_KEY && env.CYBS_SECRET_KEY && env.PAYMENT_RECEIPT_SECRET);
    return json(200, {
      gateway,
      available,
      enabledMethods: available ? ['card'] : [],
      message: available ? null : 'CyberSource payment is not configured',
    });
  }
  return json(200, { gateway, available: false, enabledMethods: [], message: 'Unsupported payment gateway configuration' });
}
