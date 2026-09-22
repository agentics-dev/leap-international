const { verifyAndDecodeToken } = require('../_cybs-token');
const { quoteOrder } = require('../_order-validation');
const { json, sendPaymentEmails } = require('../_stripe-shared');
const { signReceipt, verifyReceipt } = require('../_receipt-token');

function extractPaymentResult(payload) {
  const amountDetails = payload && payload.orderInformation && payload.orderInformation.amountDetails;
  const card = payload && payload.paymentInformation && payload.paymentInformation.card;
  return {
    paymentId: String(payload && payload.id || ''),
    status: String(payload && payload.status || 'UNKNOWN').toUpperCase(),
    amount: Number(amountDetails && amountDetails.totalAmount),
    currency: String(amountDetails && amountDetails.currency || '').toUpperCase(),
    method: card ? `${card.type || card.brand || 'Card'} ****${card.last4 || ''}`.trim() : 'Card',
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (!body.completeResponse || typeof body.completeResponse !== 'string') {
    return json(400, { error: 'Missing completeResponse JWT' });
  }
  if (!env.PAYMENT_RECEIPT_SECRET) return json(503, { error: 'Payment verification is not configured' });

  let checkout;
  try {
    checkout = await verifyReceipt(body.checkout_token, env.PAYMENT_RECEIPT_SECRET);
  } catch (error) {
    return json(400, { error: 'Checkout context could not be verified' });
  }
  if (checkout.type !== 'checkout_context' || checkout.gateway !== 'cybersource') {
    return json(400, { error: 'Invalid checkout context' });
  }
  const quote = quoteOrder(checkout.order, checkout.discountCode, env);
  if (!quote.valid) return json(400, { error: quote.reason, code: quote.code });
  if (quote.total !== checkout.amount || quote.currency !== checkout.currency) {
    return json(400, { error: 'Checkout context does not match the current catalog' });
  }

  let payload;
  try {
    payload = await verifyAndDecodeToken(body.completeResponse, env);
  } catch (error) {
    console.error('CyberSource result signature verification failed:', error.message);
    return json(400, { error: 'Payment response could not be verified' });
  }

  const result = extractPaymentResult(payload);
  if (!result.paymentId || result.currency !== quote.currency || result.amount !== quote.total) {
    return json(400, { error: 'Payment result does not match the server quote' });
  }

  const successStatuses = new Set(['AUTHORIZED', 'SUCCEEDED', 'TRANSMITTED']);
  const processingStatuses = new Set(['PENDING', 'PENDING_AUTHENTICATION']);
  const publicStatus = successStatuses.has(result.status)
    ? 'succeeded'
    : processingStatuses.has(result.status) ? 'processing' : 'failed';
  const customerName = String(checkout.customer && checkout.customer.name || '').trim().slice(0, 120);
  const customerEmail = String(checkout.customer && checkout.customer.email || '').trim().toLowerCase().slice(0, 254);

  let receiptToken = null;
  if (publicStatus === 'succeeded') {
    if (!env.PAYMENT_RECEIPT_SECRET) return json(503, { error: 'Payment succeeded but receipt service is unavailable' });
    await sendPaymentEmails({
      env,
      amount: result.amount,
      currency: result.currency,
      customerName,
      customerEmail,
      method: result.method,
      paymentId: result.paymentId,
      status: 'SUCCEEDED',
      locale: body.locale || 'en',
      gateway: 'CyberSource',
    });
    receiptToken = await signReceipt({
      type: 'payment_receipt',
      gateway: 'cybersource',
      paymentId: result.paymentId,
      status: publicStatus,
      amount: result.amount,
      currency: result.currency,
      method: result.method,
      customerName,
      customerEmail,
    }, env.PAYMENT_RECEIPT_SECRET);
  }

  return json(200, {
    verified: true,
    status: publicStatus,
    payment_id: result.paymentId,
    amount: result.amount,
    currency: result.currency,
    method: result.method,
    receipt_token: receiptToken,
  });
}
