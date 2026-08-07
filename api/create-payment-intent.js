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
    [0, 79, 1545, 2350, 2500].forEach((price) => prices.add(price));
    return prices;
  } catch (e) {
    console.error('Failed to load pricing data for validation:', e.message);
    return new Set([0, 79, 1545, 2350, 2500]);
  }
}

const DISCOUNT_CODES = {
  WELCOME10: { type: 'percent', value: 10 },
  LEAP500: { type: 'fixed', value: 500 },
  FOUNDERS: { type: 'fixed', value: 1000 },
  PARTNER15: { type: 'percent', value: 15 },
};

function calculateDiscount(subtotal, discountCode) {
  if (!discountCode) return 0;
  const code = DISCOUNT_CODES[String(discountCode).trim().toUpperCase()];
  if (!code) return 0;
  if (code.type === 'percent') return Math.round(subtotal * code.value / 100);
  if (code.type === 'fixed') return Math.min(code.value, subtotal);
  return 0;
}

function normalizeLineItems(lineItems, validPrices) {
  if (!Array.isArray(lineItems) || lineItems.length === 0 || lineItems.length > 20) {
    return { valid: false, reason: 'Invalid line items' };
  }

  const normalized = [];
  for (const item of lineItems) {
    const quantity = Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10 ? item.quantity : 1;
    const unitPrice = typeof item.unit_price === 'number' ? item.unit_price : Number(item.price);
    if (!Number.isInteger(unitPrice) || Math.abs(unitPrice) > 200000) {
      return { valid: false, reason: 'Invalid line item price' };
    }

    const isDiscountLine = unitPrice < 0;
    if (isDiscountLine && !/discount|折扣/i.test(`${item.name || ''} ${item.label || ''}`)) {
      return { valid: false, reason: 'Invalid negative line item' };
    }
    if (!validPrices.has(Math.abs(unitPrice))) {
      return { valid: false, reason: 'Line item price is not in the service catalog' };
    }

    const name = String(item.name || item.label || 'Service').slice(0, 120);
    normalized.push({
      name,
      quantity,
      unit_price: unitPrice,
      price: unitPrice,
      type: 'service',
      sku: String(item.sku || item.code || ('svc-' + name.slice(0, 16).replace(/\s+/g, '-').toLowerCase())).slice(0, 64),
    });
  }

  return { valid: true, items: normalized };
}

function validateOrder({ amount, currency, line_items, discount_code, discount_amount }) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1) {
    return { valid: false, reason: 'Invalid amount' };
  }
  if (amount > 200000) {
    return { valid: false, reason: 'Amount exceeds maximum limit' };
  }
  if (!Number.isInteger(amount)) {
    return { valid: false, reason: 'Amount must be a whole number' };
  }
  if (currency !== 'HKD') {
    return { valid: false, reason: 'Unsupported currency' };
  }

  const validPrices = loadValidPrices();
  const normalized = normalizeLineItems(line_items, validPrices);
  if (!normalized.valid) return normalized;

  const subtotal = normalized.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  if (!Number.isInteger(subtotal) || subtotal < 1 || subtotal > 200000) {
    return { valid: false, reason: 'Invalid order total' };
  }

  const expectedDiscount = calculateDiscount(subtotal, discount_code);
  if ((Number(discount_amount) || 0) !== expectedDiscount) {
    return { valid: false, reason: 'Discount amount mismatch' };
  }

  const expectedAmount = subtotal - expectedDiscount;
  if (amount !== expectedAmount) {
    return { valid: false, reason: 'Amount does not match server-calculated order total' };
  }

  return { valid: true, products: normalized.items, subtotal, discountAmount: expectedDiscount };
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

    const validation = validateOrder({ amount, currency, line_items, discount_code, discount_amount });
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
          products: validation.products.map(({ price, ...product }) => product),
        },
        metadata: {
          customer_name: customer_name || '',
          customer_email: customer_email || '',
          source: 'leap-international-website-vercel',
          mastercard_aggregator_id: process.env.MASTERCARD_AGGREGATOR_ID || '',
          mastercard_submerchant_id: process.env.MASTERCARD_SUBMERCHANT_ID || '',
          locale: locale || 'en',
          discount_code: discount_code || '',
          discount_amount: validation.discountAmount,
          line_items_json: JSON.stringify(validation.products),
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
      line_items: validation.products,
      discount_code: discount_code || '',
      discount_amount: validation.discountAmount,
      locale: locale || 'en',
    });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
