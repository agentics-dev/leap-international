// netlify/functions/process-payment.js
// CyberSource Unified Checkout — 验证客户端返回的付款结果 JWT，并做业务处理。
//
// 架构（与官方示例一致）：
//   captureContext 带 completeMandate:{type:'AUTH'} → SDK 在浏览器直接完成授权 →
//   返回 completeResponse（签名 JWT）→ 前端把 JWT 发给本函数 →
//   本函数用 CyberSource JWKS 公钥验签 → 取出付款结果 → 发邮件 + 存记录。
//
// 本函数不调任何 CyberSource API；付款已由 SDK 完成，这里只做"确认 + 落库 + 通知"。
// 后续如需真正收钱（请款 capture），再单独调 PaymentsApi 的 capture 接口。

const { verifyAndDecodeToken } = require('./_cybs-token');

function json(status, payload) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

// ====== 邮件 / 通知（复用原 webhook 的逻辑，简化版） ======
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

// 从验签后的 JWT payload 里提取付款信息
// completeResponse 的 payload 结构 = PtsV2PaymentsPost201Response
function extractPaymentResult(payload) {
  const p = payload || {};
  return {
    paymentId: p.id || '',
    status: p.status || 'UNKNOWN', // AUTHORIZED / DECLINED / etc.
    amount: p.orderInformation && p.orderInformation.amountDetails && p.orderInformation.amountDetails.totalAmount,
    currency: p.orderInformation && p.orderInformation.amountDetails && p.orderInformation.amountDetails.currency,
    reconciliationId: p.reconciliationId || '',
    cardLast4:
      p.paymentInformation &&
      p.paymentInformation.card &&
      p.paymentInformation.card.last4,
    cardBrand:
      p.paymentInformation &&
      p.paymentInformation.card &&
      (p.paymentInformation.card.type || p.paymentInformation.card.brand),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;

  try {
    const body = JSON.parse(event.body || '{}');
    const { completeResponse, customer_name, customer_email, line_items, discount_code, discount_amount, locale } = body;

    if (!completeResponse || typeof completeResponse !== 'string') {
      return json(400, { error: 'Missing completeResponse JWT' });
    }

    // ★ 核心：用 CyberSource 公钥验签（不信任前端 payload）
    let payload;
    try {
      payload = await verifyAndDecodeToken(completeResponse);
    } catch (verifyErr) {
      console.error('JWT verification failed:', verifyErr.message);
      return json(400, { error: 'Invalid or tampered payment response', detail: verifyErr.message });
    }

    const result = extractPaymentResult(payload);
    const formattedAmount = formatAmount(result.amount, result.currency);

    // 业务通知：只有授权成功才发邮件
    if (result.status === 'AUTHORIZED' || result.status === 'PENDING') {
      const displayMethod = [result.cardBrand, result.cardLast4 ? '****' + result.cardLast4 : ''].filter(Boolean).join(' ');
      const displayTime = new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });

      // 1) 通知公司
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

      // 2) 客户确认邮件
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
};
