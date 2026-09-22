const { json } = require('../_stripe-shared');
const { verifyReceipt } = require('../_receipt-token');

export async function onRequestPost(context) {
  if (!context.env.PAYMENT_RECEIPT_SECRET) return json(503, { error: 'Receipt verification is unavailable' });
  let body;
  try {
    body = await context.request.json();
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }
  try {
    const receipt = await verifyReceipt(body.receipt_token, context.env.PAYMENT_RECEIPT_SECRET);
    if (receipt.type !== 'payment_receipt' || receipt.status !== 'succeeded') {
      return json(400, { verified: false, error: 'Invalid payment receipt' });
    }
    return json(200, {
      verified: true,
      receipt: {
        gateway: receipt.gateway,
        paymentId: receipt.paymentId,
        status: receipt.status,
        amount: receipt.amount,
        currency: receipt.currency,
        method: receipt.method,
        customerName: receipt.customerName || '',
        customerEmail: receipt.customerEmail || '',
      },
    });
  } catch (error) {
    return json(400, { verified: false, error: error.message });
  }
}
