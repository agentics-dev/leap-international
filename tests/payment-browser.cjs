const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const baseUrl = process.env.PAYMENT_TEST_URL || 'http://localhost:8888/pages/payment';
const screenshots = path.join(process.cwd(), 'test-results');
fs.mkdirSync(screenshots, { recursive: true });

const incorporationOrder = {
  incorporationPlan: 'Starter',
  incorporationPrice: 8500,
  incorporationSource: 'incorporation-foreigners',
  secretaryPlan: 'standard',
  shareholderCount: 4,
  hasOfficeAddress: true,
};

async function preparePage(browser, viewport, order = incorporationOrder) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((storedOrder) => {
    localStorage.setItem('leap-package-inc', JSON.stringify(storedOrder));
    sessionStorage.setItem('leap-checkout-flow', 'incorporation');
    window.Stripe = function () {
      return {
        elements: function () {
          return {
            create: function () {
              const listeners = {};
              return {
                on: (name, handler) => { listeners[name] = handler; },
                mount: (selector) => {
                  document.querySelector(selector).innerHTML = '<div id="mockPaymentElement" style="padding:18px;border:1px solid #cfd6df;border-radius:6px">Mock secure payment form</div>';
                  setTimeout(() => listeners.ready && listeners.ready(), 10);
                },
                destroy: () => {},
              };
            },
            submit: async () => ({}),
          };
        },
        confirmPayment: async () => ({ paymentIntent: { id: 'pi_browser_test' } }),
      };
    };
  }, order);
  await page.route('https://js.stripe.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/api/payment-config', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ gateway: 'stripe', available: true, enabledMethods: ['card'], stripePublishableKey: 'pk_test_browser_mock' }),
  }));
  await page.route('**/api/create-stripe-intent', async (route) => {
    const quoteResponse = await page.request.post('http://localhost:8888/api/quote-order', { data: { order: {
      flow: 'incorporation',
      incorporation: { residency: 'non_hk', plan: 'starter' },
      secretary: { plan: 'standard', shareholders: 4 },
      registeredOffice: true,
    } } });
    const quote = await quoteResponse.json();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ client_secret: 'pi_mock_secret_mock', payment_intent_id: 'pi_browser_test', quote }) });
  });
  await page.route('**/api/confirm-stripe-payment', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'processing', payment_id: 'pi_browser_test' }),
  }));
  return { context, page, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 375, height: 812 },
  ];

  for (const viewport of viewports) {
    const { context, page, errors } = await preparePage(browser, viewport);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#totalValue').textContent.includes('12,700'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `horizontal overflow at ${viewport.width}`);
    assert.equal(await page.locator('#mobilePaybar').evaluate((el) => el.classList.contains('visible')), false);
    await page.screenshot({ path: path.join(screenshots, `payment-${viewport.width}.png`), fullPage: true });

    await page.fill('#firstName', 'Alan');
    await page.fill('#lastName', 'Lai');
    await page.fill('#email', 'not-an-email');
    assert.equal(await page.locator('#continueButton').isDisabled(), true);
    await page.fill('#email', 'alan@example.com');
    assert.equal(await page.locator('#continueButton').isEnabled(), true);
    await page.click('#continueButton');
    await page.waitForSelector('#mockPaymentElement');
    assert.equal(await page.locator('#payButton').isEnabled(), true);
    if (viewport.width <= 800) {
      assert.equal(await page.locator('#mobilePaybar').evaluate((el) => el.classList.contains('visible')), true);
      await page.screenshot({ path: path.join(screenshots, `payment-${viewport.width}-step2.png`), fullPage: true });
    }
    await page.click('#backButton');
    assert.equal(await page.locator('#detailsForm').isVisible(), true);
    assert.equal(await page.locator('#mobilePaybar').evaluate((el) => el.classList.contains('visible')), false);
    assert.deepEqual(errors, []);
    await context.close();
  }

  const empty = await preparePage(browser, { width: 375, height: 812 }, {});
  await empty.page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert.equal(await empty.page.locator('#orderError').isVisible(), true);
  assert.equal(await empty.page.locator('#continueButton').isDisabled(), true);
  assert.deepEqual(empty.errors, []);
  await empty.context.close();

  const receiptContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const receiptPage = await receiptContext.newPage();
  await receiptPage.goto('http://localhost:8888/pages/confirmation?amount=1&name=Forged', { waitUntil: 'networkidle' });
  assert.equal(await receiptPage.locator('#invalid').isVisible(), true);
  assert.equal(await receiptPage.locator('#verified').isVisible(), false);
  await receiptContext.close();

  for (const lang of ['en', 'zh-Hant', 'zh-Hans']) {
    const failureContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const failurePage = await failureContext.newPage();
    await failurePage.goto(`http://localhost:8888/pages/payment-failed?reason=Declined&amount=8500&lang=${encodeURIComponent(lang)}`, { waitUntil: 'networkidle' });
    assert.equal(await failurePage.locator('#reason').textContent(), 'Declined');
    assert.match(await failurePage.locator('#amount').textContent(), /8,500/);
    assert.notEqual((await failurePage.locator('#title').textContent()).trim(), '');
    await failureContext.close();
  }

  await browser.close();
  console.log('Payment browser checks passed at 1440, 1024, 768 and 375px.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
