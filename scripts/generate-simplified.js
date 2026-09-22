// scripts/generate-simplified.js
// 预生成简体中文：为缺少简体兄弟节点的 .lang-zh 元素补上转换后的节点。
// 零运行时延迟，不依赖 CDN。
//
// 用法：node scripts/generate-simplified.js
// 可以多次运行（幂等）；--check 检查缺口和已有简体文案，不写文件。

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
let traditionalInSimplified = 0;
const checkOnly = process.argv.includes('--check');

HTML_FILES.forEach(filePath => {
  const relPath = path.relative(ROOT, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 保留已有简体文案，只补紧邻繁体节点后缺失的对应元素。

  const result = [];
  let lastIndex = 0;
  const elementStartRegex = /<(span|p|h4)\b[^>]*>/g;
  let match;

  while ((match = elementStartRegex.exec(content)) !== null) {
    const tag = match[1];
    const classMatch = match[0].match(/class=(["'])(.*?)\1/);
    if (!classMatch || !classMatch[2].split(/\s+/).includes('lang-zh')) continue;

    const tagStart = match.index;
    // 找到本元素的结束标签（包括嵌套的同名元素）。
    let depth = 1;
    let pos = match.index + match[0].length;
    while (depth > 0 && pos < content.length) {
      const nextOpen = content.indexOf(`<${tag}`, pos);
      const nextClose = content.indexOf(`</${tag}>`, pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + tag.length + 1;
      } else {
        depth--;
        pos = nextClose + tag.length + 3;
      }
    }
    if (depth !== 0) continue;
    const tagEnd = pos;

    const nextElement = content.slice(tagEnd).match(/^\s*<([a-z][\w-]*)\b([^>]*)>/i);
    const nextClass = nextElement && nextElement[0].match(/class=(["'])(.*?)\1/);
    if (nextElement && nextElement[1].toLowerCase() === tag && nextClass &&
        nextClass[2].split(/\s+/).includes('lang-zh-Hans')) {
      elementStartRegex.lastIndex = tagEnd;
      continue;
    }

    const fullElement = content.substring(tagStart, tagEnd);

    // 把元素里的所有文本转成简体
    // 策略：提取纯文本部分，转换，但保留 HTML 标签
    let simplified = fullElement
      .replace(/(>)([^<]*)(<)/g, (m, openTag, text, closeTag) => {
        return openTag + convert(text) + closeTag;
      });

    // 修改克隆的 class：加 lang-zh-Hans 和 lang-zh-Hans-clone
    simplified = simplified.replace(/class=(["'])(.*?)\1/, (m, quote, classes) => {
      const newClasses = classes.split(/\s+/).map(c => c === 'lang-zh' ? 'lang-zh-Hans' : c);
      newClasses.push('lang-zh-Hans-clone');
      return `class=${quote}${newClasses.join(' ')}${quote}`;
    });

    result.push(content.substring(lastIndex, tagEnd));
    result.push(simplified);
    lastIndex = tagEnd;
    totalElements++;

    elementStartRegex.lastIndex = tagEnd;
  }

  result.push(content.substring(lastIndex));
  content = result.join('');

  if (content !== original) {
    if (!checkOnly) fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    console.log(`${checkOnly ? '缺少简体' : '已补齐'} ${relPath}`);
  }

  if (checkOnly) {
    const { JSDOM } = require('jsdom');
    const document = new JSDOM(content).window.document;
    document.querySelectorAll('.lang-zh-Hans').forEach(element => {
      const text = element.textContent.trim();
      if (text !== convert(text)) {
        traditionalInSimplified++;
        console.error(`简体残留繁体 ${relPath}: ${text.slice(0, 80)}`);
      }
    });
  }
});

console.log(`\n总计: ${totalFiles} 个文件，${totalElements} 个简体元素${checkOnly ? '待补齐' : '已生成'}`);
if (checkOnly) console.log(`已有简体文案残留繁体: ${traditionalInSimplified} 处`);
if (checkOnly && (totalElements || traditionalInSimplified)) process.exitCode = 1;
