const { submitEnquiry } = require('../_enquiry');
const { json } = require('../_stripe-shared');

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const result = await submitEnquiry(body, context.env);
  return json(result.status, result.body);
}
