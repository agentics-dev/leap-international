// scripts/i18n-migrate.js
// 批量给 pages/*.html 添加三语支持：
// 1. <head> 加 <script src="/js/i18n.js" defer>
// 2. CSS 删除旧的 lang-en/lang-zh 显示规则（注释替代）
// 3. 语言切换器：zh → zh-Hant，加第三个 zh-Hans 按钮
// 4. 删除内联的 setLang/normaliseLang/LANG_KEY 代码块（i18n.js 接管）
//
// 不处理：index.html（已手动改）、stripe-return.html（无切换器）、confirmation.html（特殊处理）
//
// 用法：node scripts/i18n-migrate.js

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'pages');
const SKIP = ['stripe-return.html']; // 无语言切换器，跳过

// 要处理的文件列表
const files = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html') && !SKIP.includes(f));

let totalChanged = 0;
let totalSkipped = 0;

files.forEach(file => {
  const filePath = path.join(PAGES_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const changes = [];

  // 1. 加 i18n.js 引用（在 </head> 前，如果还没有的话）
  if (!content.includes('/js/i18n.js')) {
    content = content.replace('</head>', '  <!-- i18n 三语切换（EN / 繁體 / 简体）-->\n  <script src="/js/i18n.js" defer></script>\n</head>');
    if (content !== original) changes.push('加 i18n.js 引用');
  }

  // 2. CSS：替换旧的 lang-en/lang-zh 显示规则
  // 匹配多种变体（5 种），替换为注释
  const cssPatterns = [
    // index 变体
    /\.lang-zh\s*\{\s*display:\s*none;\s*\}\s*\n\s*html\[data-lang="en"\]\s*\.lang-zh\s*\{\s*display:\s*none\s*!important;?\s*\}\s*\n\s*html\[data-lang="zh"\]\s*\.lang-en\s*\{\s*display:\s*none\s*!important;?\s*\}\s*\n\s*html\[data-lang="zh"\]\s*\.lang-zh\s*\{\s*display:\s*block\s*!important;?\s*\}/,
    // pricing 变体
    /html\[data-lang="en"\]\s*\.lang-zh\s*\{\s*display:\s*none\s*!important;?\s*\}\s*\n\s*html\[data-lang="zh"\]\s*\.lang-zh\s*\{\s*display:\s*inline\s*!important;?\s*\}\s*\n\s*html\[data-lang="zh"\]\s*\.lang-en\s*\{\s*display:\s*none\s*!important;?\s*\}/,
    // payment 变体（无 !important）
    /html\[data-lang="en"\]\s*\.lang-en\s*\{\s*display:\s*block;?\s*\}\s*\n\s*html\[data-lang="en"\]\s*\.lang-zh\s*\{\s*display:\s*none;?\s*\}\s*\n\s*html\[data-lang="zh"\]\s*\.lang-en\s*\{\s*display:\s*none;?\s*\}\s*\n\s*html\[data-lang="zh"\]\s*\.lang-zh\s*\{\s*display:\s*block;?\s*\}/,
    // confirmation 变体（[data-lang] 非 html[]）
    /\[data-lang="en"\]\s*\.lang-en\s*\{\s*display:\s*block;?\s*\}\s*\n\s*\[data-lang="en"\]\s*\.lang-zh\s*\{\s*display:\s*none;?\s*\}\s*\n\s*\[data-lang="zh"\]\s*\.lang-en\s*\{\s*display:\s*none;?\s*\}\s*\n\s*\[data-lang="zh"\]\s*\.lang-zh\s*\{\s*display:\s*block;?\s*\}/,
    // 通用 fallback：任何包含 data-lang="zh" 的 CSS 规则块（单行或多行）
    /\.lang-zh\s*\{\s*display:\s*none;?\s*\}\s*\nhtml\[data-lang="zh"\]\s*\.lang-en\s*\{\s*display:\s*none\s*!important;?\s*\}\s*\nhtml\[data-lang="zh"\]\s*\.lang-zh\s*\{\s*display:\s*(?:block|inline)\s*!important;?\s*\}/,
  ];

  let cssChanged = false;
  for (const pattern of cssPatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, '/* 三语显示规则由 js/i18n.js 统一注入 */');
      cssChanged = true;
      break;
    }
  }
  // 如果上面的模式没匹配到，尝试更宽松的：删除所有含 data-lang="zh" 的 CSS 行
  if (!cssChanged) {
    const loosePattern = /^[^\n]*data-lang="zh"[^\n]*\{[^\n]*\}\s*$/gm;
    const beforeLen = content.length;
    content = content.replace(loosePattern, '');
    // 清理可能残留的 .lang-zh 默认隐藏规则
    content = content.replace(/^\.lang-zh\s*\{\s*display:\s*none;?\s*\}\s*$/gm, '');
    if (content.length !== beforeLen) {
      cssChanged = true;
    }
  }
  if (cssChanged) changes.push('清理旧 CSS');

  // 3. 语言切换器：zh → zh-Hant，加第三个按钮
  // 模式：<button data-lang="zh" ...>...<span>🇨🇳</span> <span>中文</span>...</button>
  const zhButtonPattern = /<button\s+data-lang="zh"([^>]*)>\s*([\s\S]*?)<\/button>/;
  if (zhButtonPattern.test(content)) {
    content = content.replace(zhButtonPattern, (match, attrs, inner) => {
      // 把中文按钮改成繁体
      let hantBtn = `<button data-lang="zh-Hant"${attrs}>`;
      hantBtn += inner.replace(/🇨🇳/g, '🇭🇰').replace(/中文/g, '繁體');
      hantBtn += `</button>`;
      // 加简体按钮（继承 classes，但确保有 rounded-b-md）
      let hansAttrs = attrs.replace('rounded-b-md', 'rounded-b-md'); // 保持
      let hansBtn = `<button data-lang="zh-Hans"${hansAttrs}><span>🇨🇳</span> <span>简体</span></button>`;
      // 从繁体按钮移除 rounded-b-md（因为现在它不是最后一个）
      hantBtn = hantBtn.replace('rounded-b-md', 'rounded-t-md').replace('rounded-b-md', '');
      // 确保替换不会重复替换（简体按钮保留 rounded-b-md）
      return hantBtn + '\n    ' + hansBtn;
    });
    changes.push('改语言切换器');
  }

  // 4. 删除内联的 setLang/normaliseLang/LANG_KEY 代码
  // 模式：var LANG_KEY = ... 到 setLang(savedLang); 结束（或包含整个语言切换 IIFE 块）
  // 小心：不同页面结构略有不同，用保守的方式——只删函数定义和调用，保留 langBtn 下拉菜单逻辑

  // 删除 normaliseLang 函数定义
  const normalisePattern = /function\s+normaliseLang\s*\([^)]*\)\s*\{\s*[^}]*\}\s*/g;
  if (normalisePattern.test(content)) {
    content = content.replace(normalisePattern, '');
    changes.push('删 normaliseLang');
  }

  // 删除 setLang 函数定义（多行，直到匹配的 }）
  // 用栈匹配来安全删除
  content = removeSetLangFunction(content, changes);

  // 删除 LANG_KEY 变量和 savedLang 逻辑
  const langKeyPattern = /var\s+LANG_KEY\s*=\s*'[^']*';\s*/g;
  if (langKeyPattern.test(content)) {
    content = content.replace(langKeyPattern, '');
    changes.push('删 LANG_KEY');
  }

  // 删除 savedLang 相关行
  const savedLangPattern = /var\s+savedLang\s*=\s*'[^']*';\s*[\s\S]*?setLang\(savedLang\);\s*/g;
  if (savedLangPattern.test(content)) {
    content = content.replace(savedLangPattern, '');
    changes.push('删 savedLang');
  }

  // 删除 URL lang 参数读取（confirmation/payment-failed 用的）
  const urlLangPattern = /var\s+params\s*=\s*new\s+URLSearchParams\(window\.location\.search\);\s*\n\s*var\s+urlLang\s*=\s*params\.get\('lang'\);\s*/g;
  if (urlLangPattern.test(content)) {
    content = content.replace(urlLangPattern, '');
  }

  // 删除语言切换器按钮的事件绑定（i18n.js 已处理）
  // 模式：langDropdown.querySelectorAll('button[data-lang]')... 整个 if 块
  const dropdownBindPattern = /if\s*\(langDropdown\)\s*\{\s*langDropdown\.querySelectorAll\('button\[data-lang\]'\)\.forEach\(function\s*\([^)]*\)\s*\{[\s\S]*?\}\);\s*\}\s*/g;
  if (dropdownBindPattern.test(content)) {
    content = content.replace(dropdownBindPattern, '');
    changes.push('删旧下拉绑定');
  }

  // 把 setLang 调用替换为空（i18n.js 自动处理初始化）
  // 但保留 urlLang || savedLang 的逻辑给 confirmation 等页面

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalChanged++;
    console.log(`✅ ${file} — ${changes.join(', ')}`);
  } else {
    totalSkipped++;
    console.log(`⏭️  ${file} — 无改动`);
  }
});

console.log(`\n总计: ${totalChanged} 个文件已修改, ${totalSkipped} 个跳过`);

// 安全删除 setLang 函数定义（用花括号匹配）
function removeSetLangFunction(content, changes) {
  const setLangStart = content.search(/function\s+setLang\s*\([^)]*\)\s*\{/);
  if (setLangStart === -1) return content;

  // 找到函数开始的 {
  let braceStart = content.indexOf('{', setLangStart);
  if (braceStart === -1) return content;

  // 用栈匹配找到函数结束的 }
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return content;

  // 删除函数（包括前后空白）
  let removeStart = setLangStart;
  let removeEnd = end;
  // 扩展删除前后的换行和空格
  while (removeStart > 0 && /\s/.test(content[removeStart - 1])) removeStart--;
  while (removeEnd < content.length && /\s/.test(content[removeEnd])) removeEnd++;

  content = content.slice(0, removeStart) + content.slice(removeEnd);
  changes.push('删 setLang 函数');
  return content;
}
