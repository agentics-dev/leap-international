// scripts/generate-simplified.js
// 预生成简体中文：扫描所有 HTML 文件的 .lang-zh 元素，用 OpenCC 转成简体，
// 在每个 .lang-zh 后面插入简体克隆 <span class="lang-zh lang-zh-Hans">。
// 零运行时延迟，不依赖 CDN。
//
// 用法：node scripts/generate-simplified.js
// 可以多次运行（幂等）：先清理旧克隆，再重新生成。

const fs = require('fs');
const path = require('path');
const OpenCC = require('opencc-js');

const convert = OpenCC.Converter({ from: 'hk', to: 'cn' });

const ROOT = path.join(__dirname, '..');
const HTML_FILES = [
  path.join(ROOT, 'index.html'),
  ...fs.readdirSync(path.join(ROOT, 'pages'))
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(ROOT, 'pages', f))
];

let totalElements = 0;
let totalFiles = 0;

HTML_FILES.forEach(filePath => {
  const relPath = path.relative(ROOT, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. 先清理旧的简体克隆（幂等）：删除所有 class 含 lang-zh-Hans-clone 的标签
  // 用正则匹配整个 span 元素（单行或多行）
  content = content.replace(/<span[^>]*class="[^"]*lang-zh-Hans-clone[^"]*"[^>]*>[\s\S]*?<\/span>/g, '');

  // 2. 找所有 class="lang-zh"（不含 lang-zh-Hans）的 span，在其后插入简体克隆
  // 匹配模式：<span class="lang-zh"...>...</span>（非贪婪，但要处理嵌套 span）
  // 由于嵌套 span 会让正则不可靠，用手动扫描

  const result = [];
  let lastIndex = 0;
  // 匹配 <span class="...lang-zh..." ...> 开始标签
  const spanStartRegex = /<span\s+([^>]*?)class="([^"]*\blang-zh\b[^"]*)"/g;
  // 注意：\blang-zh\b 不匹配 lang-zh-Hans（因为后面有 - 不是边界）
  // 但要确保 class 不含 lang-zh-Hans
  let match;

  while ((match = spanStartRegex.exec(content)) !== null) {
    const fullClass = match[3] || match[2]; // class 属性值
    // 跳过已经是简体克隆的
    if (fullClass.includes('lang-zh-Hans')) continue;
    // 跳过已包含简体克隆标记的
    if (fullClass.includes('lang-zh-Hans-clone')) continue;

    const tagStart = match.index;
    // 找匹配的 </span>（考虑嵌套）
    let depth = 1;
    let pos = match.index + match[0].length;
    while (depth > 0 && pos < content.length) {
      const nextOpen = content.indexOf('<span', pos);
      const nextClose = content.indexOf('</span>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 5;
      } else {
        depth--;
        pos = nextClose + 7;
      }
    }
    const tagEnd = pos; // </span> 之后

    const fullElement = content.substring(tagStart, tagEnd);

    // 把元素里的所有文本转成简体
    // 策略：提取纯文本部分，转换，但保留 HTML 标签
    let simplified = fullElement
      .replace(/(>)([^<]*)(<)/g, (m, openTag, text, closeTag) => {
        return openTag + convert(text) + closeTag;
      });

    // 修改克隆的 class：加 lang-zh-Hans 和 lang-zh-Hans-clone
    simplified = simplified.replace(
      /(<span\s+[^>]*?)class="([^"]*\blang-zh\b[^"]*)"/,
      (m, prefix, classes) => {
        // 移除 lang-zh，加 lang-zh-Hans
        let newClasses = classes.replace(/\blang-zh\b/g, 'lang-zh-Hans') + ' lang-zh-Hans-clone';
        return `${prefix}class="${newClasses}"`;
      }
    );

    // 注意：克隆元素不应该有 lang-zh 类（否则会被繁体 CSS 显示）
    // 上面已经把 lang-zh 替换成了 lang-zh-Hans，所以 OK

    result.push(content.substring(lastIndex, tagEnd));
    result.push(simplified);
    lastIndex = tagEnd;
    totalElements++;

    spanStartRegex.lastIndex = tagEnd;
  }

  result.push(content.substring(lastIndex));
  content = result.join('');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    console.log(`✅ ${relPath}`);
  } else {
    console.log(`⏭️  ${relPath} — 无 .lang-zh 元素`);
  }
});

console.log(`\n总计: ${totalFiles} 个文件，${totalElements} 个简体元素已生成`);
console.log('\n下一步: 同步到 dist，重启 localhost 测试');
