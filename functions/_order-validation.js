// Canonical order catalog and server-side quotation logic.
// Browser-supplied prices are intentionally ignored.

const CATALOG = require('../js/pricing-catalog');
const CURRENCY = CATALOG.currency;
const MAX_ORDER_TOTAL = 200000;
const MAX_SHAREHOLDERS = 50;

function fail(code, reason) {
  return { valid: false, code, reason };
}

function normalizeEnum(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeShareholders(value) {
  const number = Number(value == null || value === '' ? 1 : value);
  if (!Number.isInteger(number) || number < 1 || number > MAX_SHAREHOLDERS) return null;
  return number;
}

function addSecretaryLines(lines, secretary, included = false) {
  if (!secretary) return { valid: true, secretary: null };
  const plan = normalizeEnum(secretary.plan);
  const shareholders = normalizeShareholders(secretary.shareholders);
  if (plan !== 'standard' && plan !== 'premium') {
    return fail('UNKNOWN_SECRETARY_PLAN', 'Unknown company secretary plan');
  }
  if (!shareholders) return fail('INVALID_SHAREHOLDERS', 'Shareholder count must be between 1 and 50');

  lines.push({
    code: included ? `secretary_${plan}_upgrade` : `secretary_${plan}`,
    name: included
      ? (plan === 'standard' ? 'First-year Standard Secretary - Included' : 'First-year Premium Secretary Upgrade')
      : (plan === 'standard' ? 'Company Secretary - Standard' : 'Company Secretary - Premium'),
    quantity: 1,
    unit_price: included ? (plan === 'premium' ? CATALOG.secretaryUpgrade : 0) : CATALOG.secretary[plan],
  });

  const extraShareholders = Math.max(0, shareholders - 2);
  if (extraShareholders) {
    lines.push({
      code: 'secretary_extra_shareholder',
      name: 'Additional shareholder service',
      quantity: extraShareholders,
      unit_price: CATALOG.secretary.shareholderSurcharge,
    });
  }
  return { valid: true, secretary: { plan, shareholders } };
}

function normalizeOrder(order) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return fail('EMPTY_ORDER', 'Please select a service package before payment');
  }

  const flow = normalizeEnum(order.flow);
  const lines = [];

  if (flow === 'incorporation') {
    const incorporation = order.incorporation || {};
    const residency = normalizeEnum(incorporation.residency);
    const plan = normalizeEnum(incorporation.plan);
    if (plan !== 'starter') return fail('UNKNOWN_INCORPORATION_PLAN', 'Unknown incorporation plan');
    if (residency !== 'local' && residency !== 'non_hk') {
      return fail('UNKNOWN_RESIDENCY', 'Unknown incorporation residency package');
    }

    lines.push({
      code: `incorporation_${residency}_starter`,
      name: residency === 'local'
        ? 'Hong Kong Company Incorporation - Local Starter'
        : 'Hong Kong Company Incorporation - Non-Hong Kong Starter',
      quantity: 1,
      unit_price: CATALOG.incorporation[residency],
    });

    const secretaryResult = addSecretaryLines(lines, order.secretary, true);
    if (!secretaryResult.valid) return secretaryResult;

    const registeredOffice = order.registeredOffice === true;
    if (registeredOffice) {
      lines.push({ code: 'registered_office', name: 'Registered Office Address', quantity: 1, unit_price: CATALOG.registeredOffice });
    }

    return {
      valid: true,
      order: {
        flow,
        incorporation: { residency, plan },
        secretary: secretaryResult.secretary,
        registeredOffice,
      },
      lines,
    };
  }

  if (flow === 'company_secretary') {
    const secretaryResult = addSecretaryLines(lines, order.secretary);
    if (!secretaryResult.valid || !secretaryResult.secretary) {
      return secretaryResult.valid
        ? fail('UNKNOWN_SECRETARY_PLAN', 'Please select a company secretary plan')
        : secretaryResult;
    }

    const remediationYears = order.remediationYears === undefined ? 0 : order.remediationYears;
    if (!Number.isSafeInteger(remediationYears) || remediationYears < 0) {
      return fail('INVALID_REMEDIATION_YEARS', 'Please enter the actual number of past years requiring annual return remediation');
    }
    if (remediationYears > 0) {
      lines.push({
        code: 'annual_return_remediation',
        name: 'Historical Annual Return Remediation (per year)',
        quantity: remediationYears,
        unit_price: CATALOG.annualReturnRemediation,
      });
    }

    const requestedAudit = order.audit;
    let audit = null;
    if (requestedAudit) {
      const revenueBand = normalizeEnum(requestedAudit.revenueBand);
      if (!Object.prototype.hasOwnProperty.call(CATALOG.audit, revenueBand)) {
        return fail('UNKNOWN_AUDIT_PLAN', 'Please select your annual revenue band again. Revenue above USD 5,000,000 requires a custom quote.');
      }
      lines.push({
        code: `audit_${revenueBand}`,
        name: `Audit and Tax Filing - ${revenueBand}`,
        quantity: 1,
        unit_price: CATALOG.audit[revenueBand],
      });
      audit = { revenueBand };
    }

    return { valid: true, order: { flow, secretary: secretaryResult.secretary, audit, remediationYears }, lines };
  }

  return fail('UNKNOWN_ORDER_FLOW', 'This order is no longer supported. Please select a package again');
}

function parseDiscountCodes(raw) {
  if (!raw) return {};
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    throw new Error('DISCOUNT_CODES_JSON is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('DISCOUNT_CODES_JSON must be an object');
  }
  return parsed;
}

function calculateDiscount(subtotal, discountCode, env, order, now = Date.now()) {
  const normalizedCode = String(discountCode || '').trim().toUpperCase();
  if (!normalizedCode) return { valid: true, code: '', amount: 0 };

  let codes;
  try {
    codes = parseDiscountCodes(env && env.DISCOUNT_CODES_JSON);
  } catch (error) {
    return fail('DISCOUNT_CONFIG_ERROR', 'Discounts are temporarily unavailable');
  }

  const rule = codes[normalizedCode];
  if (!rule || rule.active === false) return fail('INVALID_DISCOUNT', 'Discount code is invalid or inactive');
  if (rule.startsAt && Date.parse(rule.startsAt) > now) return fail('INVALID_DISCOUNT', 'Discount code is not active yet');
  if (rule.expiresAt && Date.parse(rule.expiresAt) <= now) return fail('EXPIRED_DISCOUNT', 'Discount code has expired');
  if (Array.isArray(rule.flows) && !rule.flows.map(normalizeEnum).includes(order.flow)) {
    return fail('DISCOUNT_NOT_APPLICABLE', 'Discount code does not apply to this service');
  }

  const type = normalizeEnum(rule.type);
  const value = Number(rule.value);
  let amount = 0;
  if (type === 'percent' && Number.isFinite(value) && value > 0 && value <= 100) {
    amount = Math.round((subtotal * value) / 100);
  } else if (type === 'fixed' && Number.isInteger(value) && value > 0) {
    amount = Math.min(value, subtotal);
  } else {
    return fail('DISCOUNT_CONFIG_ERROR', 'Discount configuration is invalid');
  }

  return { valid: true, code: normalizedCode, amount };
}

function quoteOrder(orderInput, discountCode, env = {}, now = Date.now()) {
  const normalized = normalizeOrder(orderInput);
  if (!normalized.valid) return normalized;

  const lineItems = normalized.lines.map((item) => ({ ...item, total: item.quantity * item.unit_price }));
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  if (!Number.isInteger(subtotal) || subtotal < 1 || subtotal > MAX_ORDER_TOTAL) {
    return fail('INVALID_ORDER_TOTAL', 'Order total is outside the supported range');
  }

  const discount = calculateDiscount(subtotal, discountCode, env, normalized.order, now);
  if (!discount.valid) return discount;
  const total = subtotal - discount.amount;
  if (total < 1) return fail('INVALID_ORDER_TOTAL', 'Order total must be greater than zero');

  return {
    valid: true,
    currency: CURRENCY,
    order: normalized.order,
    lineItems,
    subtotal,
    discountCode: discount.code,
    discountAmount: discount.amount,
    total,
  };
}

module.exports = {
  CATALOG,
  CURRENCY,
  MAX_ORDER_TOTAL,
  normalizeOrder,
  parseDiscountCodes,
  calculateDiscount,
  quoteOrder,
};
