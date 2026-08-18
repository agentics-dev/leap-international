// functions/_stripe-shared.js
// Stripe 支付用的共享工具：JSON 响应、金额格式化、HTML 转义、Resend 邮件发送。
// 邮件模板复用 CyberSource process-payment.js 的风格。

const { validateOrder } = require('./_order-validation');

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

// 格式化金额：8800 → "HKD 8,800.00"
function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  return `${currency || 'HKD'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// 港币金额（整数元）→ Stripe 需要的最小单位（分）。HKD 无小数货币。
function toStripeAmount(hkd) {
  return Math.round(Number(hkd) * 100);
}

async function sendResendEmail({ apiKey, from, to, subject, html, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: [replyTo] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

// 生成支付成功通知邮件（发给公司）
function buildNotifyEmail({ amount, currency, customerName, customerEmail, method, paymentId, status }) {
  const formattedAmount = formatAmount(amount, currency);
  const displayTime = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
  return {
    from: 'Leap International <notify@leapcorpser.com>',
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
      <p><strong>Gateway:</strong> Stripe</p>
    </div>`,
  };
}

// 生成客户确认邮件
function buildCustomerEmail({ amount, currency, customerName, paymentId, locale }) {
  const formattedAmount = formatAmount(amount, currency);
  const isZh = (locale === 'zh' || locale === 'zh-Hant' || locale === 'zh-Hans');
  const tr = (en, zh) => (isZh ? zh : en);
  return {
    from: 'Leap International <notify@leapcorpser.com>',
    subject: isZh
      ? `✅ Leap International 付款確認 — ${formattedAmount}`
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

// 发送支付成功的两封邮件（通知 + 客户确认）
async function sendPaymentEmails({ env, amount, currency, customerName, customerEmail, method, paymentId, status, locale }) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const NOTIFY_EMAIL = env.NOTIFY_EMAIL;
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) return;

  const notify = buildNotifyEmail({ amount, currency, customerName, customerEmail, method, paymentId, status });
  try {
    await sendResendEmail({ apiKey: RESEND_API_KEY, to: NOTIFY_EMAIL, ...notify });
  } catch (e) {
    console.error('Notify email failed:', e.message);
  }

  if (customerEmail) {
    const customer = buildCustomerEmail({ amount, currency, customerName, paymentId, locale });
    try {
      await sendResendEmail({ apiKey: RESEND_API_KEY, to: customerEmail, replyTo: NOTIFY_EMAIL, ...customer });
    } catch (e) {
      console.error('Customer email failed:', e.message);
    }
  }
}

module.exports = { json, escapeHtml, formatAmount, toStripeAmount, sendResendEmail, sendPaymentEmails, validateOrder };
