const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

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

function loadValidPrices() {
  try {
    const pricingPath = path.join(process.cwd(), 'pages', 'pricing-data.json');
    const raw = fs.readFileSync(pricingPath, 'utf-8');
    const data = JSON.parse(raw);
    const prices = new Set();

    function extractNumbers(obj) {
      if (!obj) return;
      if (typeof obj === 'string') {
        const match = obj.match(/HK\$\s*([\d,]+)/);
        if (match) prices.add(parseInt(match[1].replace(/,/g, ''), 10));
      } else if (typeof obj === 'object') {
        Object.values(obj).forEach(extractNumbers);
      }
    }

    extractNumbers(data);
    return prices;
  } catch (e) {
    console.error('Failed to load pricing data for validation:', e.message);
    return new Set();
  }
}

function validateAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1) {
    return { valid: false, reason: 'Invalid amount' };
  }
  if (amount > 200000) {
    return { valid: false, reason: 'Amount exceeds maximum limit' };
  }
  if (!Number.isInteger(amount)) {
    return { valid: false, reason: 'Amount must be a whole number' };
  }

  const validPrices = loadValidPrices();
  if (validPrices.size > 0 && !validPrices.has(amount)) {
    const sorted = [...validPrices].sort((a, b) => a - b);
    const combinations = new Set();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i; j < sorted.length; j++) {
        const sum = sorted[i] + sorted[j];
        if (sum <= 200000) combinations.add(sum);
      }
    }
    if (!combinations.has(amount)) {
      console.warn(`Amount ${amount} not in known price list or common combinations, but allowing`);
    }
  }

  return { valid: true };
}

function resolveSiteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers.host;
  return host ? `https://${host}` : 'http://localhost:3000';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const AIRWALLEX_CLIENT_ID = process.env.AIRWALLEX_CLIENT_ID;
  const AIRWALLEX_API_KEY = process.env.AIRWALLEX_API_KEY;
  const AIRWALLEX_API_BASE = process.env.AIRWALLEX_API_BASE || 'https://api.airwallex.com';
  const SITE_URL = resolveSiteUrl(req);

  if (!AIRWALLEX_CLIENT_ID || !AIRWALLEX_API_KEY) {
    return json(res, 500, { error: 'Airwallex credentials not configured' });
  }

  try {
    const rawBody = await readRawBody(req);
    const { amount, currency, customer_name, customer_email, line_items, discount_code, discount_amount, locale } = JSON.parse(rawBody || '{}');

    if (!amount || !currency) {
      return json(res, 400, { error: 'Missing amount or currency' });
    }

    const validation = validateAmount(amount);
    if (!validation.valid) {
      return json(res, 400, { error: validation.reason });
    }

    const requestId = `leap-${generateUUID()}`;
    const orderRef = `order-leap-${Date.now()}`;

    const authRes = await fetch(`${AIRWALLEX_API_BASE}/api/v1/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2019-09-01',
      },
      body: JSON.stringify({
        client_id: AIRWALLEX_CLIENT_ID,
        api_key: AIRWALLEX_API_KEY,
      }),
    });

    if (!authRes.ok) {
      return json(res, authRes.status, { error: `Auth failed: ${await authRes.text()}` });
    }

    const authData = await authRes.json();
    const token = authData.token;
    if (!token) {
      return json(res, 500, { error: 'Failed to obtain auth token' });
    }

    const intentRes = await fetch(`${AIRWALLEX_API_BASE}/api/v1/pa/payment_intents/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': requestId,
      },
      body: JSON.stringify({
        amount,
        currency,
        request_id: requestId,
        return_url: `${SITE_URL}/pages/confirmation.html`,
        order: {
          reference: orderRef,
          products: Array.isArray(line_items)
            ? line_items.map((it) => ({
                name: it.name || it.label || 'Service',
                quantity: it.quantity || 1,
                unit_price: typeof it.unit_price === 'number' ? it.unit_price : Number(it.price) || 0,
                type: 'service',
                sku: it.sku || it.code || ('svc-' + (it.name || 'item').slice(0, 16).replace(/\s+/g, '-').toLowerCase()),
              }))
            : undefined,
        },
        metadata: {
          customer_name: customer_name || '',
          customer_email: customer_email || '',
          source: 'leap-international-website-vercel',
          mastercard_aggregator_id: process.env.MASTERCARD_AGGREGATOR_ID || '',
          mastercard_submerchant_id: process.env.MASTERCARD_SUBMERCHANT_ID || '',
          locale: locale || 'en',
          discount_code: discount_code || '',
          discount_amount: typeof discount_amount === 'number' ? discount_amount : 0,
          line_items_json: Array.isArray(line_items) ? JSON.stringify(line_items) : '[]',
        },
      }),
    });

    if (!intentRes.ok) {
      return json(res, intentRes.status, { error: `Intent creation failed: ${await intentRes.text()}` });
    }

    const intentData = await intentRes.json();
    return json(res, 200, {
      id: intentData.id,
      client_secret: intentData.client_secret,
      request_id: requestId,
      amount,
      currency,
      customer_name: customer_name || '',
      customer_email: customer_email || '',
      line_items: Array.isArray(line_items) ? line_items : [],
      discount_code: discount_code || '',
      discount_amount: typeof discount_amount === 'number' ? discount_amount : 0,
      locale: locale || 'en',
    });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
