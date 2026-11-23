const { verifyAndDecodeToken } = require('../_cybs-token');
const { quoteOrder } = require('../_order-validation');
const { json, sendPaymentEmails } = require('../_stripe-shared');
const { signReceipt, verifyReceipt } = require('../_receipt-token');

function extractPaymentResult(payload) {
  const details = payload.details || payload;
  const amountDetails = details.orderInformation && details.orderInformation.amountDetails;
  const card = details.paymentInformation && details.paymentInformation.card;
  return {
    paymentId: String(payload.id || ''),
    reference: details.clientReferenceInformation?.code,
    status: String(payload.status || 'UNKNOWN').toUpperCase(),
    amount: Number(amountDetails && amountDetails.totalAmount),
    currency: String(amountDetails && amountDetails.currency || '').toUpperCase(),
    method: card ? `${card.type || card.brand || 'Card'} ****${card.last4 || ''}`.trim() : 'Card',
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (String(env.PAYMENT_GATEWAY || 'stripe').trim().toLowerCase() !== 'cybersource') {
    return json(409, { error: 'CyberSource is not the active payment gateway' });
  }
  if (!env.CYBS_MERCHANT_ID || !env.PAYMENT_RECEIPT_SECRET) {
    return json(503, { error: 'Payment verification is not configured' });
  }
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }
  if (!body || !body.completeResponse || typeof body.completeResponse !== 'string') {
    return json(400, { error: 'Missing completeResponse JWT' });
  }

  let checkout;
  try {
    checkout = await verifyReceipt(body.checkout_token, env.PAYMENT_RECEIPT_SECRET);
  } catch (error) {
    return json(400, { error: 'Checkout context could not be verified' });
  }
  if (checkout.type !== 'checkout_context' || checkout.gateway !== 'cybersource' ||
      checkout.merchantId !== env.CYBS_MERCHANT_ID || typeof checkout.reference !== 'string' || !checkout.reference) {
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
  if (!result.paymentId || result.reference !== checkout.reference || result.currency !== quote.currency || result.amount !== quote.total) {
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
    try {
      await sendPaymentEmails({
        env,
        amount: result.amount,
        currency: result.currency,
        customerName,
        customerEmail,
        method: result.method,
        paymentId: result.paymentId,
        status: 'SUCCEEDED',
        locale: checkout.locale || 'en',
        gateway: 'CyberSource',
        paymentTime: checkout.iat,
      });
    } catch {
      console.error('CyberSource payment notification failed:', result.paymentId);
    }
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
