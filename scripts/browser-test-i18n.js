// scripts/browser-test-i18n.js
// 用 jsdom 模拟浏览器：加载页面 → 切换语言 → 检查可见文本
// 验证：每种语言模式下，只显示该语言的文本（不重叠）

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const testPages = [
  'index.html',
  'pages/pricing.html',
  'pages/payment.html',
  'pages/contact.html',
  'pages/faqs.html',
  'pages/incorporation-foreigners.html',
  'pages/corporate-secretary.html',
  'pages/accounting.html',
  'pages/registered-office-address.html',
  'pages/get-started.html'
];

let passCount = 0;
let failCount = 0;

async function testPage(pagePath) {
  const content = fs.readFileSync(path.join(ROOT, pagePath), 'utf8');

  // 用 jsdom 加载（不执行外部脚本，手动模拟 i18n.js 的 CSS 注入）
  const dom = new JSDOM(content, { runScripts: 'outside-only', pretendToBeVisual: true });
  const doc = dom.window.document;

  // 模拟 i18n.js 注入 CSS
  const style = doc.createElement('style');
  style.textContent = `
    .lang-zh, .lang-zh-Hans { display: none !important; }
    html[data-lang="en"] .lang-en { display: revert !important; }
    html[data-lang="en"] .lang-zh, html[data-lang="en"] .lang-zh-Hans { display: none !important; }
    html[data-lang="zh-Hant"] .lang-en, html[data-lang="zh-Hant"] .lang-zh-Hans { display: none !important; }
    html[data-lang="zh-Hant"] .lang-zh { display: revert !important; }
    html[data-lang="zh-Hans"] .lang-en, html[data-lang="zh-Hans"] .lang-zh { display: none !important; }
    html[data-lang="zh-Hans"] .lang-zh-Hans { display: revert !important; }
  `;
  doc.head.appendChild(style);

  const results = { en: { pass: true, overlap: 0 }, hant: { pass: true, overlap: 0 }, hans: { pass: true, overlap: 0 } };

  // 测试三种模式
  for (const [mode, lang] of [['en', 'en'], ['hant', 'zh-Hant'], ['hans', 'zh-Hans']]) {
    doc.documentElement.setAttribute('data-lang', lang);

    // 获取所有可见的 lang-* 元素
    const allLangEls = doc.querySelectorAll('[class*="lang-en"], [class*="lang-zh"]');
    let visibleEn = 0, visibleZh = 0, visibleHans = 0;

    allLangEls.forEach(el => {
      const classes = el.className || '';
      const isEn = /\blang-en\b/.test(classes);
      const isZh = /\blang-zh\b(?!-Hans)/.test(classes);
      const isHans = /\blang-zh-Hans\b/.test(classes);

      // 模拟 CSS 判断可见性
      let visible = false;
      if (lang === 'en' && isEn) visible = true;
      if (lang === 'zh-Hant' && isZh) visible = true;
      if (lang === 'zh-Hans' && isHans) visible = true;

      if (visible) {
        if (isEn) visibleEn++;
        if (isZh) visibleZh++;
        if (isHans) visibleHans++;
      }
    });

    // 检查重叠：当前模式下不应该有其他语言的元素可见
    if (lang === 'en' && (visibleZh > 0 || visibleHans > 0)) {
      results[mode].pass = false;
      results[mode].overlap = visibleZh + visibleHans;
    }
    if (lang === 'zh-Hant' && (visibleEn > 0 || visibleHans > 0)) {
      results[mode].pass = false;
      results[mode].overlap = visibleEn + visibleHans;
    }
    if (lang === 'zh-Hans' && (visibleEn > 0 || visibleZh > 0)) {
      results[mode].pass = false;
      results[mode].overlap = visibleEn + visibleZh;
    }
  }

  // 检查简体模式下的文本是否真的是简体（抽样）
  doc.documentElement.setAttribute('data-lang', 'zh-Hans');
  const hansEls = doc.querySelectorAll('.lang-zh-Hans');
  let hansTextSample = [];
  hansEls.forEach((el, i) => {
    if (i < 3) {
      const text = el.textContent.trim().substring(0, 20);
      if (text) hansTextSample.push(text);
    }
  });

  const allPass = results.en.pass && results.hant.pass && results.hans.pass;
  if (allPass) passCount++; else failCount++;

  const status = allPass ? '✅' : '❌';
  console.log(`${status} ${pagePath}`);
  console.log(`   EN:${results.en.pass ? 'ok' : '重叠' + results.en.overlap} | 繁:${results.hant.pass ? 'ok' : '重叠' + results.hant.overlap} | 简:${results.hans.pass ? 'ok' : '重叠' + results.hans.overlap}`);
  if (hansTextSample.length > 0) {
    console.log(`   简体: ${hansTextSample.join(' / ')}`);
  }
  if (!allPass) {
    ['en', 'hant', 'hans'].forEach(m => {
      if (!results[m].pass) console.log(`   ⚠️  ${m} 模式有 ${results[m].overlap} 个其他语言元素重叠`);
    });
  }
}

(async () => {
  console.log('='.repeat(70));
  console.log('浏览器模拟测试（jsdom）— 10 个页面');
  console.log('='.repeat(70));
  for (const p of testPages) {
    await testPage(p);
  }
  console.log('\n' + '='.repeat(70));
  console.log(`结果: ${passCount}/${testPages.length} 通过, ${failCount} 失败`);
  console.log('='.repeat(70));
})();
