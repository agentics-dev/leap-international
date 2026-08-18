# 安全报告修复说明（报告 ID: afecdec7）

对应报告:P1 37 / P2 3 / P3 2。逐项处理如下。

## 一、密钥与敏感数据(9 项 P1)—— 8 误报 + 1 文件处置

| 报告位置 | 判定 | 处理 |
|---|---|---|
| netlify/functions/payment-webhook.js:332-333 | **误报**。`process.env.AIRWALLEX_*` 是环境变量读取,非硬编码 | 文件为已弃用的 Airwallex/Netlify 遗留代码,已删除 |
| netlify/functions/process-payment.js:76 | **误报**(同上,`process.env.RESEND_API_KEY`) | 文件为 Netlify 遗留,已删除 |
| functions/_stripe-shared.js:91 | **误报**(`env.RESEND_API_KEY` 环境变量读取) | 保留,线上正确用法 |
| functions/api/process-payment.js:91 | **误报**(同上) | 保留 |
| api/create-payment-intent.js:151 | **误报**(`process.env.AIRWALLEX_*`) | Airwallex 遗留,已删除 |
| api/payment-webhook.js:227-228 | **误报**(同上) | Airwallex 遗留,已删除 |
| admin_src/.env:2 (VITE_SUPABASE_ANON_KEY) | Supabase anon key 按设计是公开的(前端使用);但该文件不应外发 | 未入 git(gitignore 已覆盖);已从交付 zip 中排除 |

**轮换建议**:所有真实密钥(CyberSource/Stripe/Resend)仅存于 Cloudflare Secrets,源码零硬编码,无需轮换。

## 二、XSS 与内容注入(20 项 P1)—— 8 真实修复 + 12 误报/已安全

### 真实修复(8 处)
| 位置 | 问题 | 修复 |
|---|---|---|
| pages/payment.html:867 | label/note/折扣码拼入 innerHTML 未转义(localStorage 可篡改) | `escapeHtml()` 转义;`escapeHtml` 已加入全站共享 js/i18n.js |
| pages/select-bank-partner.html:773 | 同上模式 | 同上 |
| pages/select-office-address.html:929 | 同上 | 同上 |
| pages/select-shareholders.html:1029 | 同上 | 同上 |
| admin ArticlePreviewDialog.jsx:90 | `dangerouslySetInnerHTML` 直渲染富文本 | 新增 `admin_src/src/lib/sanitize.js`(DOM 白名单净化器,移除 script/iframe/on*/危险协议),渲染前净化 |
| pages/accounting.html:1180 | `innerHTML = el.innerHTML` 复制 | 改为清空 + `cloneNode` 显式安全复制 |
| pages/bookkeeping.html:1139 / cs-accounting.html:573 / sales-invoice.html:1130 / annual-return-filing.html:1151 | 同上模式 | 同上(annual-return 改为 createElement+textContent) |

### 误报/已安全(12 处)
| 位置 | 判定 |
|---|---|
| index.html:1308 / select-checkout-option.html:723 (calDays) | 内容为 Date 运算生成的日历数字,无用户输入 |
| pages/confirmation.html:244 | 已用 `escapeHtml(it.name)` 转义(报告只见 innerHTML 行) |
| pages/payment-failed.html:156 | innerHTML 只写空 span,用户内容走 `.textContent`(安全赋值) |
| pages/news.html:522 | 卡片字段已全部 `escapeHtml()` |
| pages/news-detail.html:486 | 已有 `sanitizeRichHtml()` DOM 白名单净化器(含协议校验) |
| pages/faqs.html:1011 | 静态错误文案,无用户输入 |
| pages/pricing.html:971 | `innerHTML = ""` 清空操作 |
| pages/pricing.html:1015 | `el()` 工厂用 createElement+textContent,安全 DOM API |
| pages/corporate-secretary.html:1182 | `'HK$' + Number.toLocaleString()` 纯数字拼接 |
| admin FaqEditor.jsx:43 | `tmp.innerHTML` 是**剥离 HTML 的净化模式**(只读 textContent),非注入 sink |

## 三、授权与业务逻辑(2 项 P1)
- **NewsEditor.jsx Mass Assignment**:payload 本就是固定字段集;已再显式增加 `WRITABLE_FIELDS` 白名单过滤写入字段。服务端最终防线为 Supabase RLS(见第五节)。
- **pricing.html 客户端价格**:纯展示;订单金额由 `functions/_order-validation.js` 服务端价格白名单重算校验,客户端不可篡改实际扣款。

## 四、越权 / IDOR(1 项 P1)
- **FaqAuditLogs.jsx:19**:`eq('faq_id', faqId)` 为管理后台内部上下文查询。代码层无法彻底修复对象级授权,真正防线是 RLS。已提供迁移脚本 `supabase/migrations/20260818_security_rls.sql`(faq_audit_logs 启用 RLS、仅 authenticated 可读、写操作默认拒绝)。**需在 Supabase Dashboard 执行一次**。

## 五、上传与公开文件(3 项 P1)—— 1 真实 + 2 误报
- **NewsEditor.jsx 上传**:已增加扩展名白名单(jpg/jpeg/png/webp/gif)+ MIME `image/*` 校验 + 5MB 大小限制;文件名本就是 `时间戳-随机串.扩展名` 随机命名(存 Supabase Storage,非 webroot)。
- **AuthorEditor.jsx / select-office-address.html**:两文件**均无文件上传代码**(后者仅是"mail scanning"文案),误报。

## 六、依赖与供应链(6 项)—— 4 修复 + 2 残留(P3)
| 依赖 | 级别 | 处理 |
|---|---|---|
| cybersource-rest-client | high | **已卸载**(线上 Cloudflare Functions 用 Web Crypto 自实现签名,从不依赖该 SDK;仅 Netlify 遗留路径引用,遗留文件一并删除) |
| axios | high | 随 cybersource-rest-client 卸载消除(其传递依赖,源码无直接引用) |
| node-jose | moderate | 同上消除 |
| uuid | moderate | 同上消除 |
| elliptic | low (P3) | jwk-to-pem 的传递依赖,暂留(CyberSource JWT 验签需要 jwk-to-pem) |
| jwk-to-pem | low (P3) | 已升级到最新版;后续可考虑用 Web Crypto 重写验签以彻底移除 |

另:`@netlify/blobs`、`jsonwebtoken`(均无人使用)一并卸载;wrangler 升级到最新(消除其工具链 undici 漏洞,仅影响本地开发,不入生产包)。

## 七、账号接管(1 项 P2)
- **Login.jsx 限流**:已加客户端限流(5 次失败锁 5 分钟)+ 统一错误信息防账号枚举。服务端兜底为 Supabase Auth 内置限流(按 IP+邮箱)。

## 遗留事项(需人工执行)
1. **执行 RLS 迁移**:Supabase Dashboard → SQL Editor 运行 `supabase/migrations/20260818_security_rls.sql`。
2. admin 后台重新构建部署(本次仅改源码):`cd admin_src && npm run build`。
3. elliptic/jwk-to-pem 两个 low 级传递依赖,后续用 Web Crypto 重写 `_cybs-token.js` 验签后可彻底移除。
