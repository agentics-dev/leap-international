const test = require('node:test');
const assert = require('node:assert/strict');
const { quoteOrder } = require('../functions/_order-validation');
const { signReceipt, verifyReceipt } = require('../functions/_receipt-token');

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
  assert.equal(quote.total, 6500);
});

test('quotes non-Hong Kong incorporation at HKD 8,500', () => {
  const quote = quoteOrder({ flow: 'incorporation', incorporation: { residency: 'non_hk', plan: 'starter' } });
  assert.equal(quote.total, 8500);
});

test('adds secretary shareholders and registered office server-side', () => {
  const quote = quoteOrder({
    flow: 'incorporation',
    incorporation: { residency: 'local', plan: 'starter' },
    secretary: { plan: 'standard', shareholders: 5 },
    registeredOffice: true,
  });
  assert.equal(quote.total, 6500 + 1300 + 600 + 2500);
});

test('quotes company secretary with audit package', () => {
  const quote = quoteOrder({
    flow: 'company_secretary',
    secretary: { plan: 'premium', shareholders: 3 },
    audit: { plan: 'standard' },
  });
  assert.equal(quote.total, 3800 + 200 + 5500);
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
