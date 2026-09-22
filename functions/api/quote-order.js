const { quoteOrder } = require('../_order-validation');
const { json } = require('../_stripe-shared');

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (error) {
    return json(400, { error: 'Invalid JSON body', code: 'INVALID_JSON' });
  }
  const quote = quoteOrder(body.order, body.discount_code, context.env);
  if (!quote.valid) return json(400, { error: quote.reason, code: quote.code });
  return json(200, quote);
}
