// functions/_order-validation.js
// 订单校验（金额、折扣、价格白名单）。Cloudflare Workers 版：价格硬编码，不读 fs。

// 价格白名单：从 pages/pricing-data.json 提取的服务价 + 固定套餐价。
// （Cloudflare Workers 无文件系统，故硬编码。改价时同步更新这里和 pricing-data.json）
const VALID_PRICES = new Set([
  0, 10, 15, 50, 79, 100, 200, 400, 1300, 1545, 1900, 2300, 2350, 2500, 2900,
  3500, 3800, 4000, 4400, 4800, 4998, 5300, 5400, 5500, 5880, 6500, 6800, 7800,
  8000, 8160, 8250, 8568, 9000, 9138, 10080, 10750, 11000, 11475, 11760, 12240,
  12852, 13500, 14400, 14875, 15000, 15120, 17500, 18870, 20825, 21600, 22000,
  22100, 22200, 24500, 25500, 26000, 30000, 32400, 34680, 39780, 40800, 46800,
  61200, 72000,
  // 注：原 regex 版会把 400000（">=HK$400,000" 标签）误纳入，已剔除
]);

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

function normalizeLineItems(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0 || lineItems.length > 20) {
    return { valid: false, reason: 'Invalid line items' };
  }
  const normalized = [];
  for (const item of lineItems) {
    const quantity =
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 10 ? item.quantity : 1;
    const unitPrice = typeof item.unit_price === 'number' ? item.unit_price : Number(item.price);
    if (!Number.isInteger(unitPrice) || unitPrice > 200000) {
      return { valid: false, reason: 'Invalid line item price' };
    }
    // 折扣只能通过 discount_code 字段处理，line items 必须为正价（防注入）
    if (unitPrice <= 0) {
      return { valid: false, reason: 'Line item price must be positive' };
    }
    if (!VALID_PRICES.has(unitPrice)) {
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

function validateOrder({ amount, currency, line_items, discount_code, discount_amount }) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1) {
    return { valid: false, reason: 'Invalid amount' };
  }
  if (amount > 200000) return { valid: false, reason: 'Amount exceeds maximum limit' };
  if (!Number.isInteger(amount)) return { valid: false, reason: 'Amount must be a whole number' };
  if (currency !== 'HKD') return { valid: false, reason: 'Unsupported currency' };

  const normalized = normalizeLineItems(line_items);
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

module.exports = { validateOrder, calculateDiscount, DISCOUNT_CODES, VALID_PRICES };
