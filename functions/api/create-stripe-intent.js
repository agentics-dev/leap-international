// functions/api/create-stripe-intent.js
// Stripe — 创建 PaymentIntent，返回 client_secret。
// Cloudflare Pages Function：路由 POST /api/create-stripe-intent

const { json, validateOrder, toStripeAmount } = require('../_stripe-shared');

// 支付方式 → Stripe payment_method_types
const METHOD_TYPES = {
  card: ['card'],
  alipay: ['alipay'],
  wechat: ['wechat_pay'],
};

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
    amount,
    currency = 'HKD',
    customer_name,
    customer_email,
    line_items,
    discount_code,
    discount_amount,
    locale,
    payment_method = 'card',
  } = body;

  // 1. 校验订单金额（复用价格白名单 + 折扣逻辑）
  const validation = validateOrder({ amount, currency, line_items, discount_code, discount_amount });
  if (!validation.valid) {
    return json(400, { error: validation.reason || 'Invalid order' });
  }

  // 2. 确定支付方式类型
  const pmTypes = METHOD_TYPES[payment_method];
  if (!pmTypes) {
    return json(400, { error: 'Unsupported payment method' });
  }

  // 3. 构造 form-encoded body（Stripe API 要求 application/x-www-form-urlencoded）
  const params = new URLSearchParams();
  params.append('amount', String(toStripeAmount(amount)));
  params.append('currency', String(currency).toLowerCase());
  params.append('automatic_payment_methods[enabled]', 'true');
  // 卡支付用 automatic_payment_methods，异步方式明确指定类型
  if (payment_method !== 'card') {
    pmTypes.forEach((t) => params.append('payment_method_types[]', t));
  }
  // 客户信息存入 metadata（webhook 用它发邮件）
  params.append('metadata[customer_name]', String(customer_name || '').slice(0, 500));
  params.append('metadata[customer_email]', String(customer_email || '').slice(0, 500));
  params.append('metadata[locale]', String(locale || 'en').slice(0, 10));
  params.append('metadata[discount_code]', String(discount_code || '').slice(0, 100));
  params.append('metadata[discount_amount]', String(discount_amount || 0));
  params.append('metadata[gateway]', 'stripe');
  params.append('description', `Leap International - ${currency} ${amount} - ${customer_name || 'N/A'}`.slice(0, 500));

  // 4. 调用 Stripe API
  try {
    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Stripe API error:', JSON.stringify(data));
      return json(res.status, { error: 'Stripe API error', detail: data.error });
    }

    // 5. 返回 client_secret + payment_intent_id
    return json(200, {
      client_secret: data.client_secret,
      payment_intent_id: data.id,
    });
  } catch (e) {
    console.error('create-stripe-intent error:', e);
    return json(500, { error: 'Failed to create payment intent', detail: e.message });
  }
}
