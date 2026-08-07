# Payment Gateway 环境全面检测报告

**检测对象：** Leap International Corporate Service Limited 官网支付系统
**线上域名：** https://leapcorpser.com
**检测日期：** 2026-08-05
**Payment Gateway：** Airwallex（生产环境）
**检测人：** ZCode 自动化审计

---

## 一、总体结论（先看这里）

> ⚠️ **支付系统当前在生产环境处于「不可用」状态。** 前端、CSP、TLS、折扣逻辑、订单校验都已就位且质量较高，但 **3 个关键服务端环境变量在 Netlify 生产环境未配置**，导致：
> - 创建付款请求一律返回 `500 Airwallex credentials not configured`
> - Webhook 一律返回 `500 Webhook signature verification is not configured`
> - 客户付款成功后**收不到任何确认邮件**、公司**收不到任何收款通知**、**付款记录完全不持久化**
>
> 修复方法很明确：在 Netlify 后台补齐环境变量即可。详见「三、严重问题」。

### 风险评级分布

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 Critical（阻断收款） | 3 | 生产环境变量缺失 |
| 🟠 High（业务/安全风险） | 4 | 收据可伪造、价格白名单污染等 |
| 🟡 Medium（健壮性） | 4 | 隐式 event、两套函数不同步等 |
| 🟢 Low（最佳实践） | 3 | Vercel 版本无持久化等 |

---

## 二、环境与架构核查

### 2.1 部署架构
| 项 | 状态 | 说明 |
|----|------|------|
| 实际生产平台 | **Netlify**（`server: Netlify`） | 线上 header 确认 |
| `/.netlify/functions/create-payment-intent` | ✅ 路由可达，GET 返回 405（正常） | 函数已部署 |
| `/.netlify/functions/payment-webhook` | ✅ 路由可达，GET 返回 405（正常） | 函数已部署 |
| `/api/create-payment-intent`（Vercel 路径） | ❌ 404 | 线上不是 Vercel |
| Netlify siteId | `8e9c9eb1-e594-4995-a784-a55946d0c71e` | `.netlify/state.json` |
| Vercel projectId | `prj_1XWertZo4XTO40MhH0hGOH1pn0VH` | 存在但未上线（备份） |

**结论：** 线上跑的是 Netlify 版函数（`netlify/functions/`），Vercel 版（`api/`）只是仓库里的镜像，未被使用。

### 2.2 TLS / 安全响应头（线上实测）
| 头 | 值 | 评价 |
|----|----|------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | ✅ 优秀 |
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ✅ |
| `Content-Security-Policy` | 见下 | ✅ 配置正确 |

**CSP 中 Airwallex 三件套全部就位：**
- `script-src` 含 `https://checkout.airwallex.com` ✅
- `connect-src` 含 `https://api.airwallex.com`、`https://checkout.airwallex.com` ✅
- `frame-src` 含 `https://checkout.airwallex.com https://*.airwallex.com` ✅
- jsPDF 依赖的 `https://cdnjs.cloudflare.com` 也在白名单 ✅

### 2.3 密钥管理（仓库）
| 项 | 状态 |
|----|------|
| `.env` 是否被 git 跟踪 | ✅ **未跟踪**（`.gitignore` 正确忽略 `.env` / `.env*`） |
| `payment_records.json`（含客户数据） | ✅ 已被 `.gitignore` 忽略 |

### 2.4 本地 `.env` 中的密钥清单
| 变量 | 本地是否有值 | 生产是否生效 |
|------|------------|------------|
| `AIRWALLEX_CLIENT_ID` | ✅ 有 | ❌ **生产缺失** |
| `AIRWALLEX_API_KEY` | ✅ 有 | ❌ **生产缺失** |
| `AIRWALLEX_API_BASE` | ✅ `https://api.airwallex.com`（生产端点） | — |
| `AIRWALLEX_WEBHOOK_SECRET` | ❌ **空** | ❌ **生产缺失** |
| `RESEND_API_KEY` | ✅ 有 | ⚠️ 无法独立验证（被前两项卡住） |
| `NOTIFY_EMAIL` | ✅ 有 | ⚠️ 同上 |
| `MASTERCARD_AGGREGATOR_ID` / `MASTERCARD_SUBMERCHANT_ID` | ✅ 有 | — |
| `SITE_URL` | `http://localhost:8888`（仅本地） | ⚠️ 见 §3.4 |

---

## 三、严重问题（🔴 Critical，阻断收款，必须立即修复）

### 🔴 P0-1：生产环境未配置 `AIRWALLEX_CLIENT_ID` / `AIRWALLEX_API_KEY`

**实测：**
```bash
curl -X POST https://leapcorpser.com/.netlify/functions/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"amount":1545,"currency":"HKD", ...}'
# HTTP 500  →  {"error":"Airwallex credentials not configured"}
```
`netlify/functions/create-payment-intent.js` 在两者缺失时直接返回 500。**任何客户点「立即支付」都会失败。**

**修复：** Netlify 后台 → Site settings → Environment variables，添加：
```
AIRWALLEX_CLIENT_ID = 6c2c6903-1b1f-45d8-91e8-76ff0f9d73ba
AIRWALLEX_API_KEY   = <与本地 .env 相同>
AIRWALLEX_API_BASE  = https://api.airwallex.com
```
然后触发一次重新部署（env 变更不会自动生效）。

> 注：从本机直接对 `api.airwallex.com` 发请求会得到上游 403（Airwallex 边缘 WAF 拦截，非凭证错误），因此**不能**用本机 curl 的 403 来判断密钥好坏——真正的判据是部署后函数能否拿到 token。

---

### 🔴 P0-2：生产环境未配置 `AIRWALLEX_WEBHOOK_SECRET`

**实测：**
```bash
curl -X POST https://leapcorpser.com/.netlify/functions/payment-webhook \
  -H "Content-Type: application/json" -d '{"test":1}'
# HTTP 500  →  "Webhook signature verification is not configured"
```
即便客户实际付款成功，Airwallex 推送的 webhook 也会被函数以 500 拒绝，导致：
- ❌ 客户**收不到付款确认邮件**（`sendCustomerConfirmation` 永不执行）
- ❌ 公司邮箱**收不到收款通知**（`sendBusinessNotification` 永不执行）
- ❌ 退款 / 争议事件**完全不感知**
- ❌ Netlify Blobs 里**没有任何付款记录**（`savePaymentRecord` 永不执行）
- ❌ Airwallex 后台会反复重试该 webhook（每次都 500）

**修复：**
1. 登录 Airwallex Dashboard → Developers → Webhooks，新建 webhook，endpoint 填
   `https://leapcorpser.com/.netlify/functions/payment-webhook`
2. 订阅事件：`payment_intent.succeeded`、`payment_intent.refunded`、`charge.refunded`、`charge.disputed`/`dispute.created`、`payment_intent.processing`、`payment_intent.cancelled`、`payment_intent.failed`
3. 复制 Airwallex 给出的 **Signing secret**，在 Netlify 环境变量加：
   ```
   AIRWALLEX_WEBHOOK_SECRET = <Airwallex signing secret>
   ```
4. 重新部署 → 在 Airwallex 后台点「Send test webhook」，函数应返回 `200 {"received":true}`。

---

### 🔴 P0-3：`AIRWALLEX_WEBHOOK_SECRET` 即便本地 `.env` 也是空

本地 `.env` 里 `AIRWALLEX_WEBHOOK_SECRET=`（空）。这意味着即使有人把 `.env` 直接灌进生产环境，webhook 校验依然会拒绝。**必须先在 Airwallex 后台拿到 signing secret。**

---

## 四、高危问题（🟠 High）

### 🟠 H-1：收据页完全信任 URL 参数，可任意伪造（含交易号）

`pages/confirmation.html` 仅从 `window.location.search` 读取 `id / amount / name / method / line_items`，**不向后端或 Airwallex 做任何二次校验**。当 `id` 缺失时还会**自动编造**一个 `TXN-YYYYMMDD-XXXX` 交易号（`confirmation.html:224`）。

**风险：** 任何人手写 URL：
```
confirmation.html?id=anything&amount=1&name=...&line_items=[...]
```
即可生成一张「看似真实」的付款收据并下载 PDF。客户可拿伪造收据声称已付款。

**修复：** 在 `confirmation.html` 加载后，用 `paymentIntentId` + `client_secret` 调用 Airwallex 的 `retrievePaymentIntent`（或在后端新增一个只读的 `/verify-intent` 端点），确认 `status === 'SUCCEEDED'` 才渲染成功页；否则跳转 `payment-failed.html`。**真正的付款凭证必须以 webhook 的 `SUCCEEDED` 事件为准，不是前端跳转。**

---

### 🟠 H-2：价格白名单被「选项标签」污染，存在绕过空间

`loadValidPrices()` 用正则 `HK\$\s*([\d,]+)` 扫描整个 `pricing-data.json`，但该正则也会匹配 `selectBar.options` 里的**金额档位文字**，例如：
- `"< HK$15K monthly expenses"` → 提取出 `15`
- `"< HK$50K monthly expenses"` → `50`
- `... HK$100K ...` → `100`、`... HK$200K ...` → `200`、`... HK$400,000 ...` → `400000`

实测白名单最终包含：`15, 50, 100, 200, 400, 400000` 等**并非真实服务价**的值。虽然 `validateOrder()` 还会做「subtotal - discount == amount」整体校验，攻击面有限，但这些「假价」混进白名单是不合理的，且 `400000` 逼近单笔上限 `200000`（会被另一条规则挡掉，但语义上仍是脏数据）。

**修复：** 让 `loadValidPrices()` 只扫描 `pricing.*` 节点，跳过 `selectBar.options`；或把白名单写成一个独立、显式的常量数组，不要用正则扫文档。

---

### 🟠 H-3：Alipay / WeChat Pay / 银行转账 三个选项是「假按钮」

`payment.html` 提供了 4 种付款方式，但 `handleFinalPayment()` 对 `alipay / wechat / bankTransfer` **不创建 intent、不调用 Airwallex**，只显示一段「请联系我们 / WhatsApp」的提示文案（`#nonCardMessage`）。`paymentMethodLabel` 仅用于拼 URL，从未传给后端或 Airwallex 的 `payment_method_type`。

**风险：** 客户以为这些是在线支付通道，实际只是「线下转账指引」，易产生纠纷与合规误解（页面 meta description 也宣称「Alipay, WeChat Pay accepted」）。

**修复（二选一）：**
- A：真正接入 Airwallex 对应的 `payment_method_type`（`alipay`、`wechatpay` 等），让前端走 redirect 流程；
- B：把这些选项从「支付方式」里移到「其他付款方式 / 线下」，并修改页面 meta description 与 OG，避免误导。

---

### 🟠 H-4：`selectCountry()` 使用隐式全局 `event`，在部分浏览器/严格模式会抛错

`payment.html:916` `event.target.classList.add('selected')` 与 `:922` 都依赖全局 `event`（IE 老写法）。在 Firefox 早期版本或启用了某些严格 CSP 的环境下，`event` 可能是 `undefined`，导致选完国家下拉不收起 / 高亮错乱（非阻断，但交互异常）。

**修复：** `function selectCountry(country, ev)`，HTML 改 `onclick="selectCountry('...', event)"`，函数内用形参 `ev`。

---

## 五、中等问题（🟡 Medium）

### 🟡 M-1：存在两套函数且已不同步（`api/` vs `netlify/functions/`）

`git status` 显示两者都被修改过，且 diff 较大：
- `api/`（Vercel 版）：用 `readRawBody`、`process.cwd()`，webhook 只 `console.log` 不持久化。
- `netlify/functions/`（线上版）：用 Netlify `event`、`@netlify/blobs` 持久化付款记录。

**风险：** 容易在改了一处忘了改另一处时引入差异。线上只用 Netlify 版，`api/` 是死代码。

**建议：** 既然线上是 Netlify，删除 `api/` 目录（或至少从部署配置移除），单一来源；或反之确定主平台后只保留一套。同时删除仓库根 `vercel.json`（线上已 404，保留会误导）。

---

### 🟡 M-2：`SITE_URL` 在生产可能解析错误

`create-payment-intent.js`（Netlify 版）按 `process.env.URL || DEPLOY_PRIME_URL || SITE_URL` 取值。Netlify 会注入 `URL` 为 **当前 deploy preview / 分支域名**（如 `deploy-preview-123--xxx.netlify.app`），导致 `return_url` 在 preview 环境指向临时域名；正式生产应锁定为 `https://leapcorpser.com`。

**修复：** 在 Netlify 生产环境显式设置 `SITE_URL=https://leapcorpser.com`，并把取值顺序改为 `SITE_URL || URL || DEPLOY_PRIME_URL`（让站点域名优先）。

---

### 🟡 M-3：`@netlify/blobs` 未在部署时确保可用

`netlify/functions/payment-webhook.js` 顶部 `require('@netlify/blobs')`。该包已在 `package.json`（`^8.1.0`）且 `node_modules` 存在。**但 Netlify Functions 打包时，`@netlify/blobs` 是平台内置还是需要随函数 bundle？** 建议在 webhook 修复后，用真实 test webhook 验证 `savePaymentRecord` 是否成功写入 Netlify Blobs（后台 → Storage → Blobs 可见 `leap-payments` store）。若报 `Cannot find module`，需在 `netlify.toml` 用 `[functions]` + `node_bundler = "esbuild"` 显式打包。

---

### 🟡 M-4：`initAirwallexCard()` 的 `env` 硬编码 `production`

`payment.html:1004` `env: 'production'`。一旦将来要在 demo / staging 站点用 Airwallex **沙盒**密钥测试，前端无法切换。

**修复：** 改为从后端返回的 intentData 里带一个 `env` 字段，或用一个独立 `/config` 端点下发（`production` / `demo`），前端据此 `init`。

---

## 六、低优先级（🟢 Low）

### 🟢 L-1：Vercel 版 webhook 完全不持久化
`api/payment-webhook.js` 的 `savePaymentRecord` 仅 `console.log`。注释写着「Vercel 版本先记录日志，避免因为缺少持久化存储导致 webhook 失败」。如果未来切回 Vercel，付款记录会丢失。建议用 Vercel KV / Postgres 或 Supabase（仓库已在用）补齐。

### 🟢 L-2：`<head>` 里两段完全相同的 `application/ld+json`（payment.html:130-152）
重复的 `WebPage` JSON-LD，对 SEO 无益甚至可能被判定为重复。删除其中一段。

### 🟢 L-3：`header { zoom: 1.38; }` 非标准属性
`zoom` 在 Firefox 下行为不一致，可能造成导航栏在不同浏览器缩放表现不一。建议改用 `transform: scale()` 或调整基础字号。

---

## 七、做得好的地方（值得保留）

1. **订单金额强校验**：`validateOrder()` 在服务端重新计算 `subtotal - discount == amount`，前端无法靠改 payload 逃单（前提是 P0-1 修复后函数能跑）。
2. **折扣码前后端一致**：`WELCOME10 / LEAP500 / FOUNDERS / PARTNER15` 与计算逻辑（`percent` / `fixed` / `Math.min`）前后端完全对齐。
3. **Webhook 签名校验**：`verifyAirwallexSignature` 用 `HMAC-SHA256(timestamp + body)` + `timingSafeEqual`，实现正确（只是密钥没配上）。
4. **CSP 很完善**，且与实际用到的所有外部域（Airwallex、Tailwind CDN、Google Fonts、Resend 走后端、Supabase、jsPDF cdnjs）严格匹配，无 `unsafe-eval`。
5. **HSTS preload + 全站 HTTPS 重定向**（`www` → 裸域 301）。
6. **`.env` 与客户数据文件已正确 gitignore**，无密钥泄漏到仓库。

---

## 八、修复优先级清单（可直接照做）

| # | 动作 | 级别 | 预计 |
|---|------|------|------|
| 1 | Netlify 后台配置 `AIRWALLEX_CLIENT_ID` / `AIRWALLEX_API_KEY` / `AIRWALLEX_API_BASE` | 🔴 | 5 min |
| 2 | Airwallex 后台建 webhook → 拿 signing secret → 配 `AIRWALLEX_WEBHOOK_SECRET` | 🔴 | 15 min |
| 3 | 触发 Netlify 重新部署 → 用真实小额订单端到端验证 | 🔴 | 20 min |
| 4 | 生产环境加 `SITE_URL=https://leapcorpser.com` | 🟡 | 2 min |
| 5 | `confirmation.html` 增加对 Airwallex 的二次校验，移除伪造交易号 | 🟠 | 1–2 h |
| 6 | 修复 `loadValidPrices` 白名单污染 | 🟠 | 30 min |
| 7 | 决定 Alipay/WeChat/银行转账的真实接入 or 移除（含改 meta description） | 🟠 | 视方案 |
| 8 | `selectCountry` 隐式 `event` 改形参 | 🟡 | 5 min |
| 9 | 清理 `api/` 死代码 / `vercel.json`，单一来源 | 🟡 | 10 min |

---

## 九、端到端验证脚本（修复后执行）

```bash
# 1) 创建付款（应返回 intent id + client_secret）
curl -X POST https://leapcorpser.com/.netlify/functions/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"amount":1545,"currency":"HKD","customer_name":"Smoke Test","customer_email":"smoke@example.com","line_items":[{"name":"Incorporation Fee to Company Registry","unit_price":1545,"quantity":1}],"discount_code":"","discount_amount":0,"locale":"en"}'
# 期望：HTTP 200 + {"id":"int_xxx","client_secret":"...","request_id":"leap-..."}

# 2) Webhook 签名校验（用 Airwallex 后台 Send test webhook）
#    期望函数日志：200 {"received":true,"event_type":"payment_intent.succeeded"}
#    并在 Netlify Blobs → leap-payments store 看到记录

# 3) 收件箱检查
#    - NOTIFY_EMAIL 应收到「💰 New Payment」
#    - 客户邮箱应收到「✅ Leap International Payment Confirmed」
```

---

*报告生成自对仓库源码 + 线上 `leapcorpser.com` 的静态与运行时检测。所有 500/405 均为真实 curl 实测结果。*
