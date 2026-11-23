const { escapeHtml, sendResendEmail } = require('./_stripe-shared');

async function submitEnquiry(body, env) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, body: { error: 'Invalid request' } };
  const limits = { name: 160, email: 254, phone: 60, service: 100, message: 6000, source: 200 };
  const data = {};
  for (const [field, limit] of Object.entries(limits)) {
    if (body[field] !== undefined && typeof body[field] !== 'string') return { status: 400, body: { error: 'Invalid field' } };
    data[field] = (body[field] || '').trim();
    if (data[field].length > limit) return { status: 400, body: { error: 'Field too long' } };
  }
  if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || /[\r\n]/.test(data.email) || (!data.message && !data.service) || !/^[0-9a-f-]{36}$/i.test(body.requestId || '')) {
    return { status: 400, body: { error: 'Please check the enquiry details' } };
  }
  if (body.website) return { status: 400, body: { error: 'Invalid request' } };
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return { status: 503, body: { error: 'Enquiry delivery unavailable' } };
  try {
    await sendResendEmail({
      apiKey: env.RESEND_API_KEY,
      from: 'Leap International Corporate Service Limited <notify@leapcorpser.com>',
      to: env.NOTIFY_EMAIL,
      replyTo: data.email,
      subject: 'New website enquiry',
      html: Object.entries(data).map(([field, value]) => `<p><strong>${field}</strong><br>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`).join(''),
      idempotencyKey: `enquiry-${body.requestId}`
    });
    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 502, body: { error: 'Enquiry delivery failed' } };
  }
}

module.exports = { submitEnquiry };
