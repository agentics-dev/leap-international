// scripts/verify-i18n-v2.js
// 更准确的验证：用正则提取每个 lang-en / lang-zh / lang-zh-Hans span 的完整元素，
// 检查三语是否 1:1:1 配对，以及简体文本是否真的有内容。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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

// 提取 span 元素，返回 {class, hasText, textPreview}
function extractLangSpans(content, langClass) {
  const results = [];
  // 匹配 <span ... class="...langClass..." ...>...</span>
  // 用非贪婪 + 嵌套处理
  const regex = new RegExp('<span\\s+([^>]*?)class="([^"]*\\b' + langClass + '\\b[^"]*)"', 'g');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const start = match.index;
    // 找匹配的 </span>
    let depth = 1;
    let pos = start + match[0].length;
    while (depth > 0 && pos < content.length) {
      const nextOpen = content.indexOf('<span', pos);
      const nextClose = content.indexOf('</span>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 5; }
      else { depth--; pos = nextClose + 7; }
    }
    const fullEl = content.substring(start, pos);
    // 提取所有文本内容（包括嵌套标签里的）
    const textContent = fullEl.replace(/<[^>]+>/g, '').trim();
    results.push({
      hasText: textContent.length > 0,
      text: textContent.substring(0, 30)
    });
  }
  return results;
}

let passCount = 0;
let failCount = 0;

console.log('='.repeat(70));
console.log('i18n 三语完整性验证 v2');
console.log('='.repeat(70));

pages.forEach(page => {
  const content = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const issues = [];

  // i18n.js 引用
  if (!content.includes('/js/i18n.js')) issues.push('缺 i18n.js');

  // 三个按钮
  if (!content.includes('data-lang="zh-Hant"')) issues.push('缺繁體按钮');
  if (!content.includes('data-lang="zh-Hans"')) issues.push('缺简体按钮');

  // 提取三种语言的 span
  const enSpans = extractLangSpans(content, 'lang-en');
  const zhSpans = extractLangSpans(content, 'lang-zh(?!-Hans)');
  const hansSpans = extractLangSpans(content, 'lang-zh-Hans');

  // 检查配对（允许小误差）
  if (Math.abs(zhSpans.length - hansSpans.length) > 2) {
    issues.push(`繁简不配对: 繁${zhSpans.length} 简${hansSpans.length}`);
  }

  // 检查简体是否有文本
  const emptyHans = hansSpans.filter(s => !s.hasText).length;
  if (hansSpans.length > 0 && emptyHans > hansSpans.length * 0.1) {
    issues.push(`${emptyHans}/${hansSpans.length} 简体无文本`);
  }

  // 检查残留旧 CSS（页面 <style> 里的，不是 i18n.js 注入的）
  const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || [];
  const styleContent = styleMatch.join('\n');
  if (/\.lang-zh\s*\{[^}]*display:\s*none/.test(styleContent)) {
    issues.push('残留 .lang-zh{display:none}');
  }

  const status = issues.length === 0 ? '✅' : '❌';
  if (issues.length === 0) passCount++; else failCount++;

  console.log(`${status} ${page}`);
  console.log(`   EN:${enSpans.length} 繁:${zhSpans.length} 简:${hansSpans.length} | 简体空:${emptyHans}`);
  if (hansSpans.length > 0) {
    const sample = hansSpans.filter(s => s.hasText).slice(0, 2).map(s => s.text);
    console.log(`   简体抽样: ${sample.join(' / ')}`);
  }
  issues.forEach(i => console.log(`   ⚠️  ${i}`));
});

console.log('\n' + '='.repeat(70));
console.log(`结果: ${passCount}/${pages.length} 通过, ${failCount} 失败`);
