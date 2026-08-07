// netlify/functions/_order-validation.js
// 订单校验逻辑（金额、折扣、价格白名单）。create-payment-intent 与 process-payment 共用。
// 从原 create-payment-intent.js 抽出，逻辑不变，仅做模块化。

const fs = require('fs');
const path = require('path');

function loadValidPrices() {
  try {
    const pricingPath = path.join(__dirname, '..', '..', 'pages', 'pricing-data.json');
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
  if (code.type === 'percent') return Math.round((subtotal * code.value) / 100);
  if (code.type === 'fixed') return Math.min(code.value, subtotal);
  return 0;
}

function normalizeLineItems(lineItems, validPrices) {
  if (!Array.isArray(lineItems) || lineItems.length === 0 || lineItems.length > 20) {
    return { valid: false, reason: 'Invalid line items' };
  }

  const normalized = [];
  for (const item of lineItems) {
    const quantity =
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10 ? item.quantity : 1;
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
      sku: String(item.sku || item.code || 'svc-' + name.slice(0, 16).replace(/\s+/g, '-').toLowerCase()).slice(0, 64),
    });
  }

  return { valid: true, items: normalized };
}

/**
 * 服务端金额重算 + 折扣校验。
 * 防止前端篡改 amount / discount_amount。
 */
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

module.exports = { validateOrder, calculateDiscount, DISCOUNT_CODES, loadValidPrices };
