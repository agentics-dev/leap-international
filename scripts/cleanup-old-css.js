// scripts/cleanup-old-css.js
// 清理所有 HTML 文件里残留的旧 i18n CSS 规则。
// 这些规则会干扰 i18n.js 注入的新规则，导致语言重叠。
//
// 清理目标（单行或多行）：
//   .lang-zh { display: none; }
//   .lang-en { display: none; }
//   .lang-zh, .lang-en { display: ... }
//   等各种变体
//
// 用法：node scripts/cleanup-old-css.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = [
  path.join(ROOT, 'index.html'),
  ...fs.readdirSync(path.join(ROOT, 'pages'))
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(ROOT, 'pages', f))
];

let total = 0;

files.forEach(filePath => {
  const relPath = path.relative(ROOT, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  // 模式 1：单行 .lang-zh { display: none; }（含各种空格/分号变体）
  content = content.replace(/^\s*\.lang-zh\s*\{\s*display:\s*none;?\s*\}\s*$/gm, '');
  count += (original.length !== content.length) ? 1 : 0;

  // 模式 2：单行 .lang-en { display: none; }（confirmation/stripe-return 的默认）
  const before2 = content.length;
  content = content.replace(/^\s*\.lang-en\s*\{\s*display:\s*none;?\s*\}\s*$/gm, '');
  if (content.length !== before2) count++;

  // 模式 3：.lang-zh, .lang-en 或 .lang-en, .lang-zh 的组合
  const before3 = content.length;
  content = content.replace(/^\s*\.lang-(?:zh|en)(?:\s*,\s*\.lang-(?:zh|en))*\s*\{\s*display:\s*[^}]+;?\s*\}\s*$/gm, '');
  if (content.length !== before3) count++;

  // 模式 4：多行块，包含 .lang-zh 或 .lang-en 的 CSS 规则（3 行以内）
  // 例如：
  //   .lang-zh {
  //     display: none;
  //   }
  const before4 = content.length;
  content = content.replace(/^\s*\.lang-(?:zh|en)\s*\{[^}]*?display:[^}]*?\}\s*$/gm, '');
  if (content.length !== before4) count++;

  // 清理可能留下的空注释行（如果旧规则被注释包裹）
  // 例如：/* ========== Language Switcher ========== */ 后面只剩空行
  content = content.replace(/\/\*\s*=+\s*Language Switcher\s*=+\s*\*\/\s*\n\s*\/\*\s*三语显示规则由 js\/i18n\.js 统一注入\s*\*\//g, '/* Language switching handled by js/i18n.js */');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    total++;
    console.log(`✅ ${relPath}`);
  }
});

console.log(`\n总计: ${total} 个文件已清理`);
