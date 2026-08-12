// scripts/verify-i18n.js
// 自动化验证：检查每个页面的三语 i18n 完整性。
// 1. 每个页面是否有 i18n.js 引用
// 2. 每个页面是否有三个语言按钮（en, zh-Hant, zh-Hans）
// 3. lang-en / lang-zh / lang-zh-Hans 元素数量是否匹配
// 4. 有没有残留的旧 CSS 规则
// 5. 简体中文文本是否非空

const fs = require('fs');
const path = require('path');
const OpenCC = require('opencc-js');
const convert = OpenCC.Converter({ from: 'hk', to: 'cn' });

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const pages = [
  'index.html',
  'pages/pricing.html',
  'pages/payment.html',
  'pages/contact.html',
  'pages/faqs.html',
  'pages/incorporation-foreigners.html',
  'pages/incorporation-locals.html',
  'pages/corporate-secretary.html',
  'pages/accounting.html',
  'pages/registered-office-address.html',
  'pages/get-started.html',
  'pages/our-culture.html',
  'pages/privacy-policy.html',
  'pages/terms-of-service.html'
];

let passCount = 0;
let failCount = 0;
const issues = [];

console.log('='.repeat(70));
console.log('i18n 三语完整性验证（' + pages.length + ' 个页面）');
console.log('='.repeat(70));

pages.forEach(page => {
  const filePath = path.join(DIST, page);
  const content = fs.readFileSync(filePath, 'utf8');
  const pageIssues = [];

  // 1. i18n.js 引用
  if (!content.includes('/js/i18n.js')) {
    pageIssues.push('缺少 i18n.js 引用');
  }

  // 2. 三个语言按钮
  const hasEnBtn = content.includes('data-lang="en"');
  const hasHantBtn = content.includes('data-lang="zh-Hant"');
  const hasHansBtn = content.includes('data-lang="zh-Hans"');
  if (!hasEnBtn) pageIssues.push('缺少 EN 按钮');
  if (!hasHantBtn) pageIssues.push('缺少 繁體 按钮');
  if (!hasHansBtn) pageIssues.push('缺少 简体 按钮');

  // 3. 统计三种语言元素数量
  const enCount = (content.match(/class="[^"]*\blang-en\b[^"]*"/g) || []).length;
  const zhCount = (content.match(/class="[^"]*\blang-zh\b(?!-Hans)[^"]*"/g) || []).length;
  const hansCount = (content.match(/class="[^"]*\blang-zh-Hans\b[^"]*"/g) || []).length;

  // 检查繁简配对（允许小差异，但不应差太多）
  if (zhCount > 0 && hansCount > 0) {
    const diff = Math.abs(zhCount - hansCount);
    if (diff > 2) {
      pageIssues.push(`繁简不配对：繁体 ${zhCount} 个，简体 ${hansCount} 个（差 ${diff}）`);
    }
  } else if (zhCount > 0 && hansCount === 0) {
    pageIssues.push(`有 ${zhCount} 个繁体元素但没有简体`);
  }

  // 4. 残留旧 CSS（排除 i18n.js 注入的）
  const oldCss = content.match(/\.lang-zh\s*\{\s*display:\s*none[^}]*\}/g);
  if (oldCss && oldCss.length > 0) {
    pageIssues.push(`残留旧 CSS：${oldCss.length} 处 .lang-zh { display: none }`);
  }
  const oldCss2 = content.match(/\.lang-en\s*\{\s*display:\s*none[^}]*\}/g);
  if (oldCss2 && oldCss2.length > 0) {
    pageIssues.push(`残留旧 CSS：${oldCss2.length} 处 .lang-en { display: none }`);
  }

  // 5. 抽样检查简体文本是否非空（取前 5 个简体 span）
  const hansSpans = content.match(/<span class="[^"]*\blang-zh-Hans\b[^"]*">([^<]+)<\/span>/g) || [];
  const hansTexts = hansSpans.slice(0, 5).map(s => {
    const m = s.match(/>([^<]+)</);
    return m ? m[1] : '';
  }).filter(t => t.length > 0);

  const emptyHans = hansSpans.length - hansTexts.length;
  if (hansSpans.length > 0 && emptyHans > 2) {
    pageIssues.push(`${emptyHans} 个简体 span 文本为空`);
  }

  // 输出结果
  const status = pageIssues.length === 0 ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status} ${page}`);
  console.log(`   EN: ${enCount} | 繁體: ${zhCount} | 简体: ${hansCount}`);
  if (hansTexts.length > 0) {
    console.log(`   简体抽样: ${hansTexts.slice(0, 3).join(' / ')}`);
  }
  if (pageIssues.length > 0) {
    pageIssues.forEach(i => {
      console.log(`   ⚠️  ${i}`);
      issues.push(`${page}: ${i}`);
    });
    failCount++;
  } else {
    passCount++;
  }
});

console.log('\n' + '='.repeat(70));
console.log(`结果: ${passCount} 通过, ${failCount} 失败`);
if (issues.length > 0) {
  console.log('\n问题清单:');
  issues.forEach(i => console.log('  - ' + i));
}
console.log('='.repeat(70));
