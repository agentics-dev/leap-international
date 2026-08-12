// scripts/fix-syntax.js
// 修复迁移脚本残留的语法错误：孤立的 ); 和 }
// 模式：在 langBtn IIFE 结尾后有多余的 ); 和 }
//
// 错误模式：
//   })();        ← IIFE 正确结尾
//   );           ← 多余
//   }            ← 多余
//   })();        ← 又一个（如果有的话）
//
// 正确应该是：
//   })();

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = [
  path.join(ROOT, 'index.html'),
  ...fs.readdirSync(path.join(ROOT, 'pages'))
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(ROOT, 'pages', f))
];

let fixed = 0;

files.forEach(filePath => {
  const relPath = path.relative(ROOT, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 修复模式 1：})();  后面紧跟 );\n  }
  // 这是 langBtn IIFE 后的残余
  content = content.replace(
    /\}\)\(\);\s*\n\s*\);\s*\n\s*\}\s*\n\s*\}\)\(\);/g,
    '})();\n})();'
  );

  // 修复模式 2：更通用的——连续的孤立 ); 和 }
  // 匹配：})();\n  );\n  }\n
  content = content.replace(
    /\}\)\(\);\s*\n\s*\);\s*\n\s*\}/g,
    '})();'
  );

  // 修复模式 3：})();\n );\n }
  content = content.replace(
    /\}\)\(\);\s*\n\s*\);(\s*\n\s*\})/g,
    '})();$1'
  );

  // 修复模式 4：langBtn IIFE 后面有 ); 和 } 残余
  // 匹配 document.addEventListener('click', ...) 闭合后多余的内容
  content = content.replace(
    /(document\.addEventListener\('click',\s*function\(\)\s*\{\s*langDropdown\.classList\.remove\('show'\);\s*\});\s*\n\s*\}\s*\n\s*\);\s*\n\s*\}\s*\n\s*\}\)\(\);)/g,
    (match) => {
      // 只保留正确的结构
      return match.replace(/\}\s*\n\s*\);\s*\n\s*\}/, '}');
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixed++;
    console.log(`✅ ${relPath}`);
  }
});

console.log(`\n修复了 ${fixed} 个文件`);
