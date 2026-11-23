const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { quoteOrder } = require('../functions/_order-validation');
const root = path.join(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));

async function loadPage(slug, storage = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'pages', slug + '.html'), 'utf8'), {
    url: `http://localhost/pages/${slug}.html?lang=en`, runScripts: 'outside-only', virtualConsole: console,
  });
  const w = dom.window;
  w.tailwind = {};
  w.matchMedia = () => ({ matches: false });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  for (const [key, value] of Object.entries(storage)) w.localStorage.setItem(key, JSON.stringify(value));
  for (const script of w.document.querySelectorAll('script')) {
    if (script.getAttribute('src')?.startsWith('/js/i18n.js')) w.eval(fs.readFileSync(path.join(root, 'js/i18n.js'), 'utf8'));
    else if (script.getAttribute('src')?.startsWith('/js/pricing-catalog.js')) w.eval(fs.readFileSync(path.join(root, 'js/pricing-catalog.js'), 'utf8'));
    else if (script.getAttribute('src')?.startsWith('/js/payment.js')) {
      w.fetch = async (_url, options) => Response.json(quoteOrder(JSON.parse(options.body).order));
      w.eval(fs.readFileSync(path.join(root, 'js/payment.js'), 'utf8'));
    }
    else if (!script.src && (!script.type || script.type === 'text/javascript')) w.eval(script.textContent);
  }
  await tick();
  assert.deepEqual(errors, [], slug);
  return dom;
}

test('bookkeeping retains the approved lowest prices when the same tier is selected again', async () => {
  const dom = await loadPage('bookkeeping');
  try {
    const ids = ['basicPrice', 'standardPrice', 'premiumPrice', 'standardOriginalPrice', 'premiumOriginalPrice'];
    const read = () => ids.map(id => dom.window.document.getElementById(id).textContent);
    const expected = ['USD 2,800', 'USD 3,978', 'USD 10,200', 'USD 4,680/yr', 'USD 12,000/yr'];
    assert.deepEqual(read(), expected);
    const option = dom.window.document.querySelector('#bookkeepingExpenseOptions [data-value="<15k"]');
    dom.window.Function(option.getAttribute('onclick')).call(option);
    assert.deepEqual(read(), expected);
  } finally { dom.window.close(); }
});

test('general price page presents approved packages in all three languages', async () => {
  const dom = await loadPage('pricing');
  try {
    const d = dom.window.document;
    const cases = {
      'incorporation-locals': ['USD 6,500'], 'incorporation-foreigners': ['USD 8,500'],
      'bookkeeping-accounting-payroll': ['USD 3,000', 'USD 2,000'],
      'corporate-secretary': ['USD 1,300', 'USD 3,800'],
      'annual-return-filing': ['USD 1,300', 'USD 3,800'],
      'audit-tax-filing': ['USD 5,000', 'USD 8,000', 'USD 12,000'],
    };
    for (const lang of ['en', 'zh', 'zh-Hans']) {
      d.documentElement.setAttribute('data-lang', lang);
      for (const [service, prices] of Object.entries(cases)) {
        const select = d.getElementById('serviceSelect');
        select.value = service;
        select.dispatchEvent(new dom.window.Event('change'));
        await tick();
        const cards = d.getElementById('pricingCards');
        for (const price of prices) assert.ok(cards.textContent.includes(price), service + ' ' + lang + ' ' + price);
        assert.equal(cards.children.length, service === 'audit-tax-filing' ? 4 : prices.length);
        assert.doesNotMatch(cards.textContent, /4,973|6,973|8,473|10,473|12,428|14,428|13,973|18,800|12,800/);
      }
    }
  } finally { dom.window.close(); }
});

test('incorporation summary matches server pricing for included service, upgrade, and extra shareholders', async () => {
  for (const [source, residency, base] of [['incorporation-locals', 'local', 6500], ['incorporation-foreigners', 'non_hk', 8500]]) {
    const dom = await loadPage('select-shareholders', { 'leap-package-inc': { incorporationPlan: 'Starter', incorporationSource: source, incorporationPrice: 1 } });
    try {
      const w = dom.window;
      const read = () => Number(w.document.getElementById('summaryTotal').textContent.replace(/[^\d.]/g, ''));
      assert.equal(read(), base);
      w.selectPlan('premium');
      assert.equal(read(), base + 2500);
      const input = w.document.getElementById('shareholderInput');
      input.value = '4'; input.dispatchEvent(new w.Event('input'));
      const quote = quoteOrder({ flow: 'incorporation', incorporation: { residency, plan: 'starter' }, secretary: { plan: 'premium', shareholders: 4 } });
      assert.equal(read(), quote.total);
    } finally { dom.window.close(); }
  }
});

test('audit selection uses annual revenue and blocks unpriced custom quotes', async () => {
  const dom = await loadPage('cs-audit-tax');
  try {
    const w = dom.window;
    assert.equal(w.document.getElementById('auditNext').disabled, true);
    for (const band of ['up_to_500k', '500k_to_2m', '2m_to_5m']) {
      w.selectRevenue(band);
      assert.equal(w.document.getElementById('auditNext').disabled, false);
      const card = w.document.querySelector(`[data-revenue-band="${band}"]`);
      assert.ok(card.textContent.includes('USD ' + w.LeapPricing.audit[band].toLocaleString('en-US')));
    }
    w.selectRevenue('custom');
    assert.equal(w.document.getElementById('auditNext').disabled, true);
    assert.equal(w.document.getElementById('auditCustomNote').classList.contains('hidden'), false);
  } finally { dom.window.close(); }
});

test('annual filing has no separate tier table and the obsolete public price file is removed', () => {
  const source = fs.readFileSync(path.join(root, 'pages/annual-return-filing.html'), 'utf8');
  assert.match(source, /No separate annual return service fee/);
  assert.doesNotMatch(source, /priceTableAnnual|selectOptionsAnnual/);
  assert.equal(fs.existsSync(path.join(root, 'pages/pricing-data.json')), false);
});

test('later incorporation steps preserve residency, upgrade, and shareholder pricing', async () => {
  for (const slug of ['select-office-address', 'select-bank-partner']) {
    const inc = { incorporationPlan: 'Starter', incorporationSource: 'incorporation-foreigners', incorporationPrice: 6973, secretaryPlan: 'premium', secretaryPrice: 3800, shareholderCount: 4 };
    const dom = await loadPage(slug, { 'leap-package-inc': inc });
    try {
      const total = () => Number(dom.window.document.getElementById('summaryTotal').textContent.replace(/[^\d.]/g, ''));
      assert.equal(total(), 8500 + 2500 + 400, slug);
      if (slug === 'select-office-address') {
        dom.window.selectOption('yes');
        assert.equal(total(), 8500 + 2500 + 400 + 2500);
      }
    } finally { dom.window.close(); }
  }
});

test('secretary review recalculates stale prices and matches each audit revenue band', async () => {
  for (const [band, amount] of Object.entries(require('../js/pricing-catalog').audit)) {
    const dom = await loadPage('cs-review', { 'leap-package-cs': { csPlan: 'premium', csPrice: 1, csShareholders: 4, csAuditPlan: 'revenue', csAuditRevenueBand: band } });
    try {
      const total = Number(dom.window.document.getElementById('reviewTotalPrice').textContent.replace(/[^\d.]/g, ''));
      assert.equal(total, 3800 + 400 + amount);
    } finally { dom.window.close(); }
  }
});

test('historical remediation requires exact years and saves the amount selected', async () => {
  const dom = await loadPage('cs-annual-returns-years');
  try {
    const w = dom.window;
    const cards = w.document.querySelectorAll('.option-card');
    for (const years of ['1', '2', '3']) {
      w.selectOption(cards[Number(years) - 1], years);
      assert.equal(w.document.getElementById('remediationTotal').textContent, 'USD ' + (1300 * Number(years)).toLocaleString('en-US'));
    }
    w.selectOption(cards[3], 'more');
    assert.equal(w.document.getElementById('remediationNext').disabled, true);
    for (const value of ['', '0', '-1', '3', '4.5']) {
      w.document.getElementById('actualYears').value = value;
      w.updateRemediationPrice();
      assert.equal(w.document.getElementById('remediationNext').disabled, true, value);
    }
    w.document.getElementById('actualYears').value = '5';
    w.updateRemediationPrice();
    assert.equal(w.document.getElementById('remediationNext').disabled, false);
    assert.equal(w.document.getElementById('remediationTotal').textContent, 'USD 6,500');
    w.goNext();
    assert.equal(JSON.parse(w.localStorage.getItem('leap-package-cs')).csAnnualReturnsYears, '5');
    w.skipThis();
    assert.equal(JSON.parse(w.localStorage.getItem('leap-package-cs')).csAnnualReturnsYears, 'skipped');
  } finally { dom.window.close(); }
});

test('review includes historical remediation only when selected', async () => {
  for (const [help, years, extra] of [['yes', '5', 6500], ['yes', 'skipped', 0], ['no', '5', 0]]) {
    const cs = { csPlan: 'standard', csShareholders: 1, csAnnualReturnsHelp: help, csAnnualReturnsYears: years, csAuditPlan: 'skipped' };
    const dom = await loadPage('cs-review', { 'leap-package-cs': cs });
    try {
      const total = Number(dom.window.document.getElementById('reviewTotalPrice').textContent.replace(/[^\d.]/g, ''));
      assert.equal(total, 1300 + extra);
      if (extra) assert.match(dom.window.document.getElementById('reviewAnnualReturnsPrice').textContent, /USD 6,500/);
    } finally { dom.window.close(); }
  }
});

test('service dropdown shows only the active language and preserves the selected service', async () => {
  const dom = await loadPage('pricing');
  try {
    const w = dom.window;
    const select = w.document.getElementById('serviceSelect');
    const expected = {
      en: ['HK resident incorporation', 'Non-resident incorporation', 'Accounting services', 'Audit & Tax Filing', 'Company Secretary', 'Annual Return Filing'],
      'zh-Hant': ['香港人公司註冊', '非香港人士公司註冊', '簿記、會計及薪酬管理', '審計及稅務申報', '公司秘書', '年度申報'],
      'zh-Hans': ['香港人公司注册', '非香港人士公司注册', '簿记、会计及薪酬管理', '审计及税务申报', '公司秘书', '年度申报'],
    };
    for (const service of Array.from(select.options, option => option.value)) {
      select.value = service;
      select.dispatchEvent(new w.Event('change'));
      for (const lang of ['en', 'zh-Hant', 'zh-Hans', 'zh-Hant', 'en']) {
        w.setLang(lang);
        await tick();
        assert.deepEqual(Array.from(select.options, option => option.textContent), expected[lang], service + '/' + lang);
        assert.equal(select.value, service);
      }
    }
  } finally { dom.window.close(); }
});

test('registered address selection matches payment even when an older order disagrees', async () => {
  for (const [legacy, current, total] of [[true, false, 6500], [false, true, 9000], [true, undefined, 9000], [undefined, undefined, 6500]]) {
    const storage = {
      'leap-package-inc': { incorporationPlan: 'Starter', incorporationSource: 'incorporation-locals', secretaryPlan: 'standard', hasOfficeAddress: legacy },
      'leap-package-cs': { hasOfficeAddress: current },
    };
    for (const page of ['select-shareholders', 'select-office-address', 'select-bank-partner', 'payment']) {
      const dom = await loadPage(page, storage);
      try {
        const id = page === 'payment' ? 'totalValue' : 'summaryTotal';
        const displayed = dom.window.document.getElementById(id).textContent;
        assert.equal(Number(displayed.replace(/[^\d.]/g, '')), total, page);
      } finally { dom.window.close(); }
    }
  }
});
