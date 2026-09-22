const { json, toStripeAmount } = require('../_stripe-shared');
const { quoteOrder } = require('../_order-validation');

function normalizeCustomer(customer) {
  const name = String(customer && customer.name || '').trim().slice(0, 120);
  const email = String(customer && customer.email || '').trim().toLowerCase().slice(0, 254);
  if (!name) return { valid: false, error: 'Customer name is required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: 'A valid customer email is required' };
  return { valid: true, name, email };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const configuredGateway = String(env.PAYMENT_GATEWAY || 'stripe').toLowerCase();
  if (configuredGateway !== 'stripe') return json(409, { error: 'Stripe is not the active payment gateway' });
  if (!env.STRIPE_SECRET_KEY) return json(503, { error: 'Stripe payment is not configured' });

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const customer = normalizeCustomer(body.customer);
  if (!customer.valid) return json(400, { error: customer.error });
  const quote = quoteOrder(body.order, body.discount_code, env);
  if (!quote.valid) return json(400, { error: quote.reason, code: quote.code });

  const locale = String(body.locale || 'en').slice(0, 10);
  const params = new URLSearchParams();
  params.append('amount', String(toStripeAmount(quote.total)));
  params.append('currency', quote.currency.toLowerCase());
  params.append('automatic_payment_methods[enabled]', 'true');
  params.append('metadata[customer_name]', customer.name);
  params.append('metadata[customer_email]', customer.email);
  params.append('metadata[locale]', locale);
  params.append('metadata[discount_code]', quote.discountCode);
  params.append('metadata[discount_amount]', String(quote.discountAmount));
  params.append('metadata[order_flow]', quote.order.flow);
  params.append('metadata[order_total]', String(quote.total));
  params.append('metadata[gateway]', 'stripe');
  params.append('description', `Leap International Corporate Service - HKD ${quote.total}`);

  const idempotencyKey = /^[A-Za-z0-9_-]{8,128}$/.test(String(body.idempotency_key || ''))
    ? `checkout-${body.idempotency_key}`
    : null;

  try {
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Stripe PaymentIntent creation failed:', data.error && data.error.type);
      return json(response.status, { error: 'Unable to start Stripe payment' });
    }
    return json(200, {
      client_secret: data.client_secret,
      payment_intent_id: data.id,
      quote,
    });
  } catch (error) {
    console.error('create-stripe-intent error:', error.message);
    return json(502, { error: 'Unable to reach Stripe' });
  }
}
