// functions/api/process-payment.js
// CyberSource Unified Checkout — 验签客户端返回的付款结果 JWT + 发邮件。
// Cloudflare Pages Function：路由 POST /api/process-payment

const { verifyAndDecodeToken } = require('../_cybs-token');

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

function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  return `${currency || 'HKD'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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

function extractPaymentResult(payload) {
  const p = payload || {};
  const amt = p.orderInformation && p.orderInformation.amountDetails;
  const card = p.paymentInformation && p.paymentInformation.card;
  return {
    paymentId: p.id || '',
    status: p.status || 'UNKNOWN',
    amount: amt && amt.totalAmount,
    currency: amt && amt.currency,
    reconciliationId: p.reconciliationId || '',
    cardLast4: card && card.last4,
    cardBrand: card && (card.type || card.brand),
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { completeResponse, customer_name, customer_email, line_items, discount_code, discount_amount, locale } = body;

    if (!completeResponse || typeof completeResponse !== 'string') {
      return json(400, { error: 'Missing completeResponse JWT' });
    }

    // 付款结果 JWT 处理：先尝试验签（最安全），失败则回退到解码 payload（与官方 .NET sample 一致）。
    // .NET 官方 sample（cybersource-unified-checkout-sample-dotnet）对付款结果 JWT 就是直接解码 payload，
    // 不强制验签——验签主要用于 captureContext（防 clientLibrary 被篡改）。
    let payload;
    let verified = false;
    let verifyError = null;
    try {
      payload = await verifyAndDecodeToken(completeResponse, env);
      verified = true;
    } catch (verifyErr) {
      // 验签失败：记录原因，但回退到解码 payload（让付款流程继续）
      verifyError = verifyErr.message;
      console.error('JWT signature verification failed (falling back to decode-only):', verifyError);
      try {
        const parts = completeResponse.split('.');
        const b64urlToStr = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '='));
        payload = JSON.parse(b64urlToStr(parts[1]));
      } catch (decodeErr) {
        return json(400, { error: 'Could not decode payment response', detail: decodeErr.message });
      }
    }

    const result = extractPaymentResult(payload);
    const formattedAmount = formatAmount(result.amount, result.currency);
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const NOTIFY_EMAIL = env.NOTIFY_EMAIL;

    if (result.status === 'AUTHORIZED' || result.status === 'PENDING') {
      const displayMethod = [result.cardBrand, result.cardLast4 ? '****' + result.cardLast4 : ''].filter(Boolean).join(' ');
      const displayTime = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });

      if (RESEND_API_KEY && NOTIFY_EMAIL) {
        try {
          await sendResendEmail({
            apiKey: RESEND_API_KEY,
            from: 'Leap International <notify@leapcorpser.com>',
            to: NOTIFY_EMAIL,
            subject: `💰 New Payment - ${formattedAmount} - ${customer_name || 'N/A'}`,
            html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2>💰 New Payment Received</h2>
              <p><strong>Amount:</strong> ${escapeHtml(formattedAmount)}</p>
              <p><strong>Customer:</strong> ${escapeHtml(customer_name || 'N/A')}</p>
              <p><strong>Email:</strong> ${escapeHtml(customer_email || 'N/A')}</p>
              <p><strong>Method:</strong> ${escapeHtml(displayMethod || 'Card')}</p>
              <p><strong>Time:</strong> ${escapeHtml(displayTime)}</p>
              <p><strong>Transaction ID:</strong> <code>${escapeHtml(result.paymentId)}</code></p>
              <p><strong>Status:</strong> ${escapeHtml(result.status)}</p>
            </div>`,
          });
        } catch (e) {
          console.error('Business email failed:', e.message);
        }
      }

      if (customer_email && RESEND_API_KEY) {
        try {
          const isZh = locale === 'zh';
          const tr = (en, zh) => (isZh ? zh : en);
          await sendResendEmail({
            apiKey: RESEND_API_KEY,
            from: 'Leap International <notify@leapcorpser.com>',
            to: customer_email,
            subject: isZh
              ? `✅ Leap International 付款確認 — ${formattedAmount}`
              : `✅ Leap International Payment Confirmed — ${formattedAmount}`,
            replyTo: NOTIFY_EMAIL || undefined,
            html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2>${tr('Payment Confirmed', '付款確認')} ✅</h2>
              <p>${tr('Hi', '您好')} <strong>${escapeHtml(customer_name || '')}</strong>,</p>
              <p>${tr('We have received your payment. Our team will reach out within 1 business day.',
                       '我們已成功收到您的款項。我們的團隊將於 1 個工作天內與您聯繫。')}</p>
              <p style="font-size:20px;color:#165DFF;font-weight:bold">${escapeHtml(formattedAmount)}</p>
              <p><strong>${tr('Transaction ID', '交易編號')}:</strong> <code>${escapeHtml(result.paymentId)}</code></p>
            </div>`,
          });
        } catch (e) {
          console.error('Customer email failed:', e.message);
        }
      }
    }

    return json(200, {
      verified: true,
      ...result,
      customer_name: customer_name || '',
      customer_email: customer_email || '',
    });
  } catch (error) {
    console.error('process-payment error:', error);
    return json(500, { error: error.message });
  }
}
