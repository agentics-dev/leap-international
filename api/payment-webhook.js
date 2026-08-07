const crypto = require('crypto');

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function savePaymentRecord(record) {
  // Vercel 版本先记录日志，避免因为缺少持久化存储导致 webhook 失败。
  console.log('Payment record:', JSON.stringify({ ...record, logged_at: new Date().toISOString() }));
}

function verifyAirwallexSignature(rawBody, signature, timestamp, secret) {
  if (!secret || !signature || !timestamp) return false;
  const payload = timestamp + rawBody;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  return `${currency || 'HKD'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBusinessEmailHtml({ displayName, displayEmail, formattedAmount, displayMethod, displayTime, displayId, eventLabel, eventBg }) {
  return `
<div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
  <div style="background: ${eventBg || '#165DFF'}; padding: 28px 32px; text-align: center;">
    <div style="font-size: 32px; margin-bottom: 4px;">${eventLabel || '💰'}</div>
    <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700;">${escapeHtml(eventLabel ? 'Payment ' + (eventLabel.includes('Refunded') ? 'Refunded' : 'Disputed') : 'New Payment Received')}</h1>
    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 6px 0 0;">Leap International Corporate Service</p>
  </div>
  <div style="padding: 28px 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 32px; font-weight: 700; color: ${eventBg || '#165DFF'};">${escapeHtml(formattedAmount)}</span>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280; font-size: 14px; width: 120px;">Customer</td><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #111827; font-size: 14px; font-weight: 600;">${escapeHtml(displayName)}</td></tr>
      <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #111827; font-size: 14px;">${escapeHtml(displayEmail)}</td></tr>
      <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280; font-size: 14px;">Payment Method</td><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #111827; font-size: 14px;">${escapeHtml(displayMethod)}</td></tr>
      <tr><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #6b7280; font-size: 14px;">Time</td><td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #111827; font-size: 14px;">${escapeHtml(displayTime)}</td></tr>
      <tr><td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Transaction ID</td><td style="padding: 12px 0; color: #9ca3af; font-size: 12px; font-family: monospace;">${escapeHtml(displayId)}</td></tr>
    </table>
  </div>
  <div style="background: #f9fafb; padding: 16px 32px; text-align: center;">
    <a href="https://www.airwallex.com/app" style="color: #165DFF; font-size: 13px; text-decoration: none; font-weight: 500;">View in Airwallex Dashboard →</a>
  </div>
</div>`;
}

function buildCustomerEmailHtml({ customerName, formattedAmount, displayMethod, displayTime, displayId, lineItems, discountCode, discountAmount, locale }) {
  const isZh = locale === 'zh';
  const tr = (en, zh) => (isZh ? zh : en);
  const safeLineItems = Array.isArray(lineItems) ? lineItems : [];
  const itemsHtml = safeLineItems.length
    ? `
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
  <thead>
    <tr style="background: #F9FAFB;">
      <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6B7280; border-bottom: 1px solid #E5E7EB;">${tr('Item', '項目')}</th>
      <th style="padding: 10px 8px; text-align: right; font-size: 12px; color: #6B7280; border-bottom: 1px solid #E5E7EB;">${tr('Amount', '金額')}</th>
    </tr>
  </thead>
  <tbody>
    ${safeLineItems.map((it) => `
      <tr>
        <td style="padding: 10px 8px; font-size: 14px; color: #111827; border-bottom: 1px solid #F3F4F6;">${escapeHtml(it.name || it.label || (isZh ? '服務' : 'Service'))}</td>
        <td style="padding: 10px 8px; font-size: 14px; color: #111827; text-align: right; border-bottom: 1px solid #F3F4F6;">${escapeHtml((it.currency || 'HKD') + ' ' + Number(it.price || it.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}</td>
      </tr>
    `).join('')}
    ${discountCode && Number(discountAmount) > 0 ? `
      <tr>
        <td style="padding: 10px 8px; font-size: 14px; color: #059669; border-bottom: 1px solid #F3F4F6;">${tr('Discount', '折扣')} (${escapeHtml(discountCode)})</td>
        <td style="padding: 10px 8px; font-size: 14px; color: #059669; text-align: right; border-bottom: 1px solid #F3F4F6;">- ${escapeHtml((formattedAmount.split(' ')[0] || 'HKD') + ' ' + Number(discountAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }))}</td>
      </tr>
    ` : ''}
  </tbody>
</table>`
    : '';

  return `
<div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
  <div style="background: #165DFF; padding: 32px 32px 28px; text-align: center;">
    <div style="font-size: 40px; margin-bottom: 8px;">✅</div>
    <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700;">${tr('Payment Confirmed', '付款確認')}</h1>
    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 8px 0 0;">${tr('Thank you for choosing Leap International', '感謝您選擇 Leap International')}</p>
  </div>
  <div style="padding: 28px 32px;">
    <p style="font-size: 15px; color: #111827; margin: 0 0 18px;">${tr('Hi', '您好')} <strong>${escapeHtml(customerName || (isZh ? '尊貴的客戶' : 'Valued Customer'))}</strong>,</p>
    <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 18px;">
      ${tr('We have received your payment successfully. A member of our team will reach out within 1 business day to begin your service. Please retain this email for your records.',
           '我們已成功收到您的款項。我們的團隊將於 1 個工作天內與您聯繫以啟動相關服務。請保留此電郵以作記錄。')}
    </p>
    <div style="background: #F0F5FF; border-radius: 10px; padding: 18px 20px; margin: 18px 0; text-align: center;">
      <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">${tr('Amount Paid', '已付金額')}</div>
      <div style="font-size: 28px; font-weight: 700; color: #165DFF;">${escapeHtml(formattedAmount)}</div>
    </div>
    ${itemsHtml}
    <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
      <tr><td style="padding: 10px 0; color: #6B7280; font-size: 13px; width: 140px;">${tr('Payment Method', '付款方式')}</td><td style="padding: 10px 0; color: #111827; font-size: 14px; font-weight: 500;">${escapeHtml(displayMethod)}</td></tr>
      <tr><td style="padding: 10px 0; color: #6B7280; font-size: 13px;">${tr('Transaction Time', '交易時間')}</td><td style="padding: 10px 0; color: #111827; font-size: 14px;">${escapeHtml(displayTime)}</td></tr>
      <tr><td style="padding: 10px 0; color: #6B7280; font-size: 13px;">${tr('Transaction ID', '交易編號')}</td><td style="padding: 10px 0; color: #6B7280; font-size: 12px; font-family: monospace; word-break: break-all;">${escapeHtml(displayId)}</td></tr>
    </table>
  </div>
  <div style="background: #F9FAFB; padding: 18px 32px; text-align: center; border-top: 1px solid #E5E7EB;">
    <p style="font-size: 12px; color: #6B7280; margin: 0 0 6px;">Leap International Corporate Service Limited</p>
    <p style="font-size: 12px; color: #9CA3AF; margin: 0;">info@leapcorpser.com · www.leapcorpser.com</p>
  </div>
</div>`;
}

async function sendResendEmail({ apiKey, from, to, subject, html, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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

async function sendBusinessNotification({ RESEND_API_KEY, NOTIFY_EMAIL, subject, html }) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) return;
  try {
    await sendResendEmail({
      apiKey: RESEND_API_KEY,
      from: 'Leap International <notify@leapcorpser.com>',
      to: NOTIFY_EMAIL,
      subject,
      html,
    });
  } catch (e) {
    console.error('Resend business email failed:', e.message);
  }
}

async function sendCustomerConfirmation({ customerEmail, customerName, formattedAmount, displayMethod, displayTime, displayId, lineItems, discountCode, discountAmount, locale, RESEND_API_KEY, NOTIFY_EMAIL }) {
  if (!customerEmail || !RESEND_API_KEY) return;
  const subject = locale === 'zh'
    ? `✅ Leap International 付款確認 — ${formattedAmount}`
    : `✅ Leap International Payment Confirmed — ${formattedAmount}`;
  try {
    await sendResendEmail({
      apiKey: RESEND_API_KEY,
      from: 'Leap International <notify@leapcorpser.com>',
      to: customerEmail,
      subject,
      html: buildCustomerEmailHtml({ customerName, formattedAmount, displayMethod, displayTime, displayId, lineItems, discountCode, discountAmount, locale }),
      replyTo: NOTIFY_EMAIL || undefined,
    });
  } catch (e) {
    console.error('Customer confirmation email failed:', e.message);
  }
}

function extractPaymentInfo(data) {
  const metadata = data.metadata || {};
  const latestAttempt = data.latest_payment_attempt || {};
  const paymentMethod = latestAttempt.payment_method || {};
  const card = paymentMethod.card || {};
  let methodLabel = '';
  if (card.brand && card.last4) methodLabel = `${card.brand.toUpperCase()} ****${card.last4}`;
  else if (data.payment_method_type) methodLabel = data.payment_method_type;
  else methodLabel = 'Card';

  let lineItems = [];
  try {
    if (Array.isArray(metadata.line_items_json)) lineItems = metadata.line_items_json;
    else if (typeof metadata.line_items_json === 'string' && metadata.line_items_json) lineItems = JSON.parse(metadata.line_items_json);
  } catch (e) {
    lineItems = [];
  }
  if (!lineItems.length && Array.isArray(metadata.line_items)) lineItems = metadata.line_items;

  return {
    customerName: metadata.customer_name || '',
    customerEmail: metadata.customer_email || '',
    amount: data.amount,
    currency: data.currency || 'HKD',
    methodLabel,
    transactionTime: data.created_at || new Date().toISOString(),
    paymentIntentId: data.id,
    locale: metadata.locale || 'en',
    discountCode: metadata.discount_code || '',
    discountAmount: Number(metadata.discount_amount) || 0,
    lineItems,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const WEBHOOK_SECRET = process.env.AIRWALLEX_WEBHOOK_SECRET;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['x-airwallex-signature'] || '';
    const timestamp = req.headers['x-airwallex-timestamp'] || '';

    if (!WEBHOOK_SECRET) {
      console.error('AIRWALLEX_WEBHOOK_SECRET not configured; rejecting webhook');
      return json(res, 500, { error: 'Webhook signature verification is not configured' });
    }

    if (!verifyAirwallexSignature(rawBody, signature, timestamp, WEBHOOK_SECRET)) {
      console.error('Webhook signature verification failed');
      return json(res, 403, { error: 'Invalid signature' });
    }

    const body = JSON.parse(rawBody || '{}');
    const eventType = body.event_type || body.type || '';
    const data = body.data && body.data.object ? body.data.object : body;

    if (eventType === 'payment_intent.succeeded' || data.status === 'SUCCEEDED') {
      const info = extractPaymentInfo(data);
      const formattedAmount = formatAmount(info.amount, info.currency);
      const displayTime = info.transactionTime ? new Date(info.transactionTime).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }) : 'N/A';

      await sendBusinessNotification({
        RESEND_API_KEY,
        NOTIFY_EMAIL,
        subject: `💰 New Payment - ${formattedAmount} - ${info.customerName || 'N/A'}`,
        html: buildBusinessEmailHtml({
          displayName: info.customerName || 'N/A',
          displayEmail: info.customerEmail || 'N/A',
          formattedAmount,
          displayMethod: info.methodLabel,
          displayTime,
          displayId: info.paymentIntentId,
          eventLabel: '💰',
          eventBg: '#165DFF',
        }),
      });

      await sendCustomerConfirmation({
        customerEmail: info.customerEmail,
        customerName: info.customerName,
        formattedAmount,
        displayMethod: info.methodLabel,
        displayTime,
        displayId: info.paymentIntentId,
        lineItems: info.lineItems,
        discountCode: info.discountCode,
        discountAmount: info.discountAmount,
        locale: info.locale,
        RESEND_API_KEY,
        NOTIFY_EMAIL,
      });

      await savePaymentRecord({ event: 'payment_succeeded', ...info });
    } else if (eventType === 'payment_intent.refunded' || eventType === 'charge.refunded') {
      const info = extractPaymentInfo(data);
      const formattedAmount = formatAmount(info.amount, info.currency);
      const displayTime = info.transactionTime ? new Date(info.transactionTime).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }) : 'N/A';
      await sendBusinessNotification({
        RESEND_API_KEY,
        NOTIFY_EMAIL,
        subject: `↩️ Refund - ${formattedAmount} - ${info.customerName || 'N/A'}`,
        html: buildBusinessEmailHtml({
          displayName: info.customerName || 'N/A',
          displayEmail: info.customerEmail || 'N/A',
          formattedAmount,
          displayMethod: info.methodLabel,
          displayTime,
          displayId: info.paymentIntentId,
          eventLabel: '↩️ Refunded',
          eventBg: '#F59E0B',
        }),
      });
      await savePaymentRecord({ event: 'payment_refunded', ...info });
    } else if (eventType === 'charge.disputed' || eventType === 'dispute.created') {
      const info = extractPaymentInfo(data);
      const formattedAmount = formatAmount(info.amount, info.currency);
      const displayTime = info.transactionTime ? new Date(info.transactionTime).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }) : 'N/A';
      await sendBusinessNotification({
        RESEND_API_KEY,
        NOTIFY_EMAIL,
        subject: `⚠️ Dispute - ${formattedAmount} - ${info.customerName || 'N/A'}`,
        html: buildBusinessEmailHtml({
          displayName: info.customerName || 'N/A',
          displayEmail: info.customerEmail || 'N/A',
          formattedAmount,
          displayMethod: info.methodLabel,
          displayTime,
          displayId: info.paymentIntentId,
          eventLabel: '⚠️ Disputed',
          eventBg: '#DC2626',
        }),
      });
      await savePaymentRecord({ event: 'payment_disputed', dispute_id: data.id, ...info });
    } else if (eventType === 'payment_intent.processing' || data.status === 'PROCESSING') {
      await savePaymentRecord({ event: 'payment_processing', ...extractPaymentInfo(data) });
    } else if (eventType === 'payment_intent.cancelled' || data.status === 'CANCELLED') {
      await savePaymentRecord({ event: 'payment_cancelled', ...extractPaymentInfo(data) });
    } else if (eventType === 'payment_intent.failed' || data.status === 'FAILED') {
      await savePaymentRecord({ event: 'payment_failed', ...extractPaymentInfo(data) });
    } else {
      await savePaymentRecord({ event: eventType || 'unknown', raw_event_type: eventType, paymentIntentId: data.id });
    }

    return json(res, 200, { received: true, event_type: eventType });
  } catch (e) {
    console.error('Webhook handler error:', e);
    return json(res, 500, { error: e.message });
  }
};
