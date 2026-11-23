const test = require('node:test');
const assert = require('node:assert/strict');
const { quoteOrder } = require('../functions/_order-validation');
const { signReceipt, verifyReceipt } = require('../functions/_receipt-token');
const { formatAmount, toStripeAmount } = require('../functions/_stripe-shared');

const discountEnv = {
  DISCOUNT_CODES_JSON: JSON.stringify({
    WELCOME10: { type: 'percent', value: 10, active: true },
    SECRETARY500: { type: 'fixed', value: 500, active: true, flows: ['company_secretary'] },
    EXPIRED: { type: 'fixed', value: 100, active: true, expiresAt: '2025-01-01T00:00:00Z' },
  }),
};

test('quotes local incorporation from the catalog', () => {
  const quote = quoteOrder({ flow: 'incorporation', incorporation: { residency: 'local', plan: 'starter' } });
  assert.equal(quote.valid, true);
  assert.equal(quote.currency, 'USD');
  assert.equal(quote.total, 6500);
});

test('quotes non-Hong Kong incorporation at USD 8,500', () => {
  const quote = quoteOrder({ flow: 'incorporation', incorporation: { residency: 'non_hk', plan: 'starter' } });
  assert.equal(quote.currency, 'USD');
  assert.equal(quote.total, 8500);
});

test('adds secretary shareholders and registered office server-side', () => {
  const quote = quoteOrder({
    flow: 'incorporation',
    incorporation: { residency: 'local', plan: 'starter' },
    secretary: { plan: 'standard', shareholders: 5 },
    registeredOffice: true,
  });
  assert.equal(quote.total, 6500 + 600 + 2500);
  assert.equal(quote.currency, 'USD');
});

test('quotes company secretary with audit package', () => {
  const quote = quoteOrder({
    flow: 'company_secretary',
    secretary: { plan: 'premium', shareholders: 3 },
    audit: { revenueBand: 'up_to_500k' },
  });
  assert.equal(quote.total, 3800 + 200 + 5000);
  assert.equal(quote.currency, 'USD');
});

test('uses USD for new payment amounts without converting their value', () => {
  assert.equal(toStripeAmount(6500), 650000);
  assert.equal(toStripeAmount(8500), 850000);
  assert.equal(formatAmount(6500), 'USD 6,500.00');
  assert.equal(formatAmount(8500, 'USD'), 'USD 8,500.00');
  assert.equal(formatAmount(6500, 'HKD'), 'HKD 6,500.00');
});

test('applies active percent and fixed discounts', () => {
  const order = { flow: 'company_secretary', secretary: { plan: 'standard', shareholders: 2 } };
  assert.equal(quoteOrder(order, 'welcome10', discountEnv).total, 1170);
  assert.equal(quoteOrder(order, 'SECRETARY500', discountEnv).total, 800);
});

test('rejects expired and inapplicable discounts', () => {
  const secretary = { flow: 'company_secretary', secretary: { plan: 'standard', shareholders: 1 } };
  const incorporation = { flow: 'incorporation', incorporation: { residency: 'local', plan: 'starter' } };
  assert.equal(quoteOrder(secretary, 'EXPIRED', discountEnv).code, 'EXPIRED_DISCOUNT');
  assert.equal(quoteOrder(incorporation, 'SECRETARY500', discountEnv).code, 'DISCOUNT_NOT_APPLICABLE');
});

test('rejects empty, stale and malformed orders', () => {
  assert.equal(quoteOrder(null).valid, false);
  assert.equal(quoteOrder({ flow: 'accounting' }).code, 'UNKNOWN_ORDER_FLOW');
  assert.equal(quoteOrder({ flow: 'company_secretary', secretary: { plan: 'standard', shareholders: 99 } }).code, 'INVALID_SHAREHOLDERS');
});

test('ignores browser price fields', () => {
  const quote = quoteOrder({
    flow: 'incorporation',
    amount: 1,
    incorporation: { residency: 'local', plan: 'starter', price: 1 },
  });
  assert.equal(quote.total, 6500);
});

test('receipt token rejects tampering and expiry', async () => {
  const secret = 'a-secure-receipt-secret-that-is-long-enough';
  const now = Date.parse('2026-08-18T00:00:00Z');
  const token = await signReceipt({ paymentId: 'pi_123', amount: 6500 }, secret, now);
  assert.equal((await verifyReceipt(token, secret, now + 1000)).paymentId, 'pi_123');
  await assert.rejects(() => verifyReceipt(`${token.slice(0, -1)}x`, secret, now + 1000));
  await assert.rejects(() => verifyReceipt(token, secret, now + (16 * 60 * 1000)));
});


test('incorporation includes Standard secretary and charges only the Premium upgrade', () => {
  for (const [residency, base] of [['local', 6500], ['non_hk', 8500]]) {
    for (const [plan, upgrade] of [['standard', 0], ['premium', 2500]]) {
      const quote = quoteOrder({ flow: 'incorporation', incorporation: { residency, plan: 'starter' }, secretary: { plan, shareholders: 4 } });
      assert.equal(quote.total, base + upgrade + 400);
      assert.equal(quote.lineItems.find(item => item.code === `secretary_${plan}_upgrade`).unit_price, upgrade);
    }
  }
});

test('annual return is included in the secretary tariff for each shareholder count', () => {
  for (const count of [1, 2, 3, 5, 30, 50]) {
    for (const [plan, base] of [['standard', 1300], ['premium', 3800]]) {
      const quote = quoteOrder({ flow: 'company_secretary', secretary: { plan, shareholders: count } });
      assert.equal(quote.total, base + Math.max(0, count - 2) * 200);
    }
  }
});

test('audit add-ons follow the service page annual-revenue tiers', () => {
  for (const [revenueBand, amount] of [['up_to_500k', 5000], ['500k_to_2m', 8000], ['2m_to_5m', 12000]]) {
    const quote = quoteOrder({ flow: 'company_secretary', secretary: { plan: 'standard', shareholders: 1 }, audit: { revenueBand, price: 1 } });
    assert.equal(quote.total, 1300 + amount);
    assert.deepEqual(quote.order.audit, { revenueBand });
  }
  for (const audit of [{ plan: 'standard' }, { revenueBand: 'custom' }, { revenueBand: 'toString' }]) {
    assert.equal(quoteOrder({ flow: 'company_secretary', secretary: { plan: 'standard', shareholders: 1 }, audit }).code, 'UNKNOWN_AUDIT_PLAN');
  }
});

test('historical annual returns are charged per actual year while current filing stays included', () => {
  for (const years of [0, 1, 2, 3, 4, 12]) {
    const q = quoteOrder({ flow: 'company_secretary', secretary: { plan: 'standard', shareholders: 2 }, remediationYears: years });
    assert.equal(q.valid, true);
    assert.equal(q.total, 1300 + 1300 * years);
    const line = q.lineItems.find(x => x.code === 'annual_return_remediation');
    assert.equal(line?.quantity || 0, years);
    if (years) assert.equal(line.unit_price, 1300);
  }
  for (const years of ['more', '3', null, true, -1, 1.5, 10000]) {
    assert.equal(quoteOrder({ flow: 'company_secretary', secretary: { plan: 'standard', shareholders: 1 }, remediationYears: years }).valid, false, String(years));
  }
});
