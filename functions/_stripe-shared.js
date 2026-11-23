// functions/_stripe-shared.js
// Stripe 支付用的共享工具：JSON 响应、金额格式化、HTML 转义、Resend 邮件发送。
// 邮件模板复用 CyberSource process-payment.js 的风格。

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 格式化金额：8800 → "USD 8,800.00"
function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  return `${currency || 'USD'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// 美元金额 → Stripe 需要的最小单位（美分）。
function toStripeAmount(amount) {
  return Math.round(Number(amount) * 100);
}

async function sendResendEmail({ apiKey, from, to, subject, html, replyTo, idempotencyKey, timeoutMs }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: [replyTo] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
  return res.json();
}

// 生成支付成功通知邮件（发给公司）
function buildNotifyEmail({ amount, currency, customerName, customerEmail, method, paymentId, status, gateway, paymentTime }) {
  const formattedAmount = formatAmount(amount, currency);
  const displayTime = Number.isInteger(paymentTime)
    ? new Date(paymentTime * 1000).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }) : 'N/A';
  return {
    from: 'Leap International Corporate Service Limited <notify@leapcorpser.com>',
    subject: `💰 New Payment - ${formattedAmount} - ${customerName || 'N/A'}`,
    html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2>💰 New Payment Received</h2>
      <p><strong>Amount:</strong> ${escapeHtml(formattedAmount)}</p>
      <p><strong>Customer:</strong> ${escapeHtml(customerName || 'N/A')}</p>
      <p><strong>Email:</strong> ${escapeHtml(customerEmail || 'N/A')}</p>
      <p><strong>Method:</strong> ${escapeHtml(method || 'Card')}</p>
      <p><strong>Time:</strong> ${escapeHtml(displayTime)}</p>
      <p><strong>Transaction ID:</strong> <code>${escapeHtml(paymentId)}</code></p>
      <p><strong>Status:</strong> ${escapeHtml(status)}</p>
      <p><strong>Gateway:</strong> ${escapeHtml(gateway || 'Stripe')}</p>
    </div>`,
  };
}

// 生成客户确认邮件
function buildCustomerEmail({ amount, currency, customerName, paymentId, locale }) {
  const formattedAmount = formatAmount(amount, currency);
  const isZh = (locale === 'zh' || locale === 'zh-Hant' || locale === 'zh-Hans');
  const tr = (en, zh) => (isZh ? zh : en);
  return {
    from: 'Leap International Corporate Service Limited <notify@leapcorpser.com>',
    subject: isZh
      ? `✅ 溱柏國際商業服務 付款確認 — ${formattedAmount}`
      : `✅ Leap International Payment Confirmed — ${formattedAmount}`,
    html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2>${tr('Payment Confirmed', '付款確認')} ✅</h2>
      <p>${tr('Hi', '您好')} <strong>${escapeHtml(customerName || '')}</strong>,</p>
      <p>${tr('We have received your payment. Our team will reach out within 1 business day.',
               '我們已成功收到您的款項。我們的團隊將於 1 個工作天內與您聯繫。')}</p>
      <p style="font-size:20px;color:#165DFF;font-weight:bold">${escapeHtml(formattedAmount)}</p>
      <p><strong>${tr('Transaction ID', '交易編號')}:</strong> <code>${escapeHtml(paymentId)}</code></p>
    </div>`,
  };
}

// The same payment must produce the same message on every provider retry.
async function sendPaymentEmails(payment, deliver = (_, message) => sendResendEmail(message)) {
  const { env, paymentId, customerEmail } = payment;
  const { RESEND_API_KEY, NOTIFY_EMAIL } = env;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) throw new Error('Payment notification is not configured');

  const business = deliver('business', {
    ...buildNotifyEmail(payment),
    apiKey: RESEND_API_KEY,
    timeoutMs: 8000,
    to: NOTIFY_EMAIL,
    idempotencyKey: `payment-${paymentId}-business`.slice(0, 256),
  });
  const customer = customerEmail && deliver('customer', {
    ...buildCustomerEmail(payment),
    apiKey: RESEND_API_KEY,
    timeoutMs: 8000,
    to: customerEmail,
    replyTo: NOTIFY_EMAIL,
    idempotencyKey: `payment-${paymentId}-customer`.slice(0, 256),
  });
  const results = await Promise.allSettled([business, customer]);
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
}

module.exports = { json, escapeHtml, formatAmount, toStripeAmount, sendResendEmail, sendPaymentEmails };
