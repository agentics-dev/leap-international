// netlify/functions/create-payment-intent.js
// CyberSource Unified Checkout — 用官方 SDK 生成 captureContext（JWT）。
// 前端调用路径不变：POST /.netlify/functions/create-payment-intent
//
// 替换了原 Airwallex 实现。鉴权由官方 SDK cybersource-rest-client 自动处理（http_signature）。

const cybersourceRestApi = require('cybersource-rest-client');
const { getConfig } = require('./_cybs-config');
const { validateOrder } = require('./_order-validation');

function json(status, payload) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function resolveSiteOrigin(event) {
  // Netlify 生产注入 process.env.URL；本地 netlify dev 回退到 SITE_URL
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.URL) return process.env.URL;
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL;
  const headers = event.headers || {};
  const host = headers.host;
  const proto = headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : 'http://localhost:8888';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let config;
  try {
    config = getConfig();
  } catch (e) {
    console.error('Config error:', e.message);
    return json(500, { error: e.message });
  }

  try {
    const {
      amount,
      currency,
      customer_name,
      customer_email,
      line_items,
      discount_code,
      discount_amount,
      locale,
    } = JSON.parse(event.body || '{}');

    if (!amount || !currency) {
      return json(400, { error: 'Missing amount or currency' });
    }

    // 服务端重算金额 + 折扣（防逃单，复用原有逻辑）
    const validation = validateOrder({ amount, currency, line_items, discount_code, discount_amount });
    if (!validation.valid) {
      return json(400, { error: validation.reason });
    }

    const siteOrigin = resolveSiteOrigin(event);

    // targetOrigins 必须用 https://（CyberSource 拒绝 http，哪怕是本地开发）
    const safeOrigin = siteOrigin.replace(/^http:/, 'https:').replace(/\/$/, '');
    const captureContextRequest = {
      clientVersion: '0.26',
      targetOrigins: [
        safeOrigin,
        'https://localhost:8888', // 本地 netlify dev（上线前可删）
      ],
      allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'JCB', 'DISCOVER', 'CUP'], // CUP=银联
      allowedPaymentTypes: ['PANENTRY'], // 先做卡，钱包后续加
      country: 'HK',
      locale: locale === 'zh' ? 'zh_HK' : 'en_US',
      // completeMandate: 让 SDK 在客户端直接完成授权，返回签名 JWT。
      // process-payment.js 只需验签这个 JWT，不必再调 CyberSource API。
      // type:'AUTH' = 授权（之后还要 capture 请款）；type:'CAPTURE' = 授权+请款一步到位。
      // Leap 服务先授权后请款，所以用 AUTH。
      completeMandate: {
        type: 'AUTH',
        decisionManager: true, // 开启风控
      },
      orderInformation: {
        amountDetails: {
          totalAmount: String(amount) + '.00',
          currency: currency || 'HKD',
        },
      },
    };

    // 调官方 SDK：generateUnifiedCheckoutCaptureContext(request, callback)
    const apiClient = new cybersourceRestApi.ApiClient();
    const apiInstance = new cybersourceRestApi.UnifiedCheckoutCaptureContextApi(config, apiClient);

    const captureContext = await new Promise((resolve, reject) => {
      apiInstance.generateUnifiedCheckoutCaptureContext(captureContextRequest, (error, data) => {
        if (error) {
          console.error('CyberSource Sessions error:', JSON.stringify(error).slice(0, 500));
          return reject(error);
        }
        resolve(data); // data 是 captureContext JWT 字符串
      });
    });

    return json(200, {
      captureContext,
      // 回传订单上下文，方便前端渲染 + 后续扣款校验
      amount,
      currency: currency || 'HKD',
      customer_name: customer_name || '',
      customer_email: customer_email || '',
      line_items: validation.products,
      subtotal: validation.subtotal,
      discount_code: discount_code || '',
      discount_amount: validation.discountAmount,
      locale: locale || 'en',
    });
  } catch (error) {
    console.error('create-payment-intent error:', error);
    const detail =
      error && error.response
        ? JSON.stringify(error.response).slice(0, 300)
        : error && error.message
          ? error.message
          : String(error);
    return json(500, { error: 'Failed to create CyberSource session', detail });
  }
};
