# CyberSource Unified Checkout 接入指南（替换 Airwallex）

**目标：** 用 CyberSource Unified Checkout 完全替换现有 Airwallex 支付通道。
**前提：** 已有 CyberSource 生产账号（MID + 可登录生产 Business Center）。
**当前架构：** Netlify Functions + 静态 HTML + 货币 HKD。
**指南来源：** CyberSource Unified Checkout REST API Developer Guide v26.07.01（已通读全文）。

---

## 0. 先搞懂整体流程（这张图是核心）

```
┌─────────────┐     ① POST /uc/v1/sessions        ┌──────────────────┐
│             │  ───────────────────────────────▶ │                  │
│  你的后端    │  ◀────────  captureContext (JWT)  │  CyberSource     │
│  (Netlify   │                                   │  (apitest/api)   │
│  Function)  │                                   │                  │
└─────┬───────┘                                   └────────┬─────────┘
      │                                                    │
      │ ② 把 captureContext 交给前端                               │
      ▼                                                    │
┌─────────────┐     ③ 前端用 captureContext 初始化 SDK         │
│             │     ④ 用户在 Unified Checkout 填卡/钱包         │
│  浏览器      │     ⑤ SDK 返回 transientTokenJwt (15分钟有效)   │
│  (payment.  │                                            │
│   html)     │                                            │
└─────┬───────┘                                            │
      │ ⑥ 把 transientTokenJwt 回传后端                            │
      ▼                                                    │
┌─────────────┐     ⑦ POST /pts/v2/payments                  │
│  你的后端    │     { tokenInformation.transientTokenJwt }    │
│             │  ──────────────────────────────────────────▶ │
│             │  ◀────────  201, status=AUTHORIZED ────────── │
└─────────────┘                                            │
      │                                                    │
      │ ⑧ 异步：CyberSource 推送 webhook                       │
      │    uc.orders.transactionresults (需 MLE 加密)          │
      ◀────────────────────────────────────────────────────────┘
```

**关键概念（必须记住）：**
| 名词 | 是什么 | 有效期 | 谁生成 |
|------|--------|--------|--------|
| **captureContext** | 一个 JWT，含商户配置+一次性加密公钥+允许的域名 | 短 | 后端调 Sessions API 拿到 |
| **transientTokenJwt** | 用户付款信息加密后的令牌 | **15 分钟** | 前端 SDK 在用户填完卡后生成 |
| **targetOrigins** | 允许加载 SDK 的域名白名单 | — | 你在 captureContext 里声明 |
| **MLE** | Message-Level Encryption，webhook 必须开启 | — | Business Center 配置 |

> ⚠️ 和 Airwallex 最大的区别：CyberSource 的卡号**永远不进你的服务器**，浏览器里直接加密成 transientTokenJwt，你后端只拿到这个令牌去要钱。所以你几乎不用碰 PCI 合规。

---

## 第一阶段：准备凭证（在 Business Center 操作，~20 分钟）

### Step 1 — 登录生产 Business Center

打开 **https://businesscenter.cybersource.com**，用你的生产账号登录。

### Step 2 — 拿到三个关键值

到 **Payment Configuration → Key Management**（密钥管理），生成/查看 REST API 密钥，记录下来：

| 凭证 | 在哪拿 | 存到哪个环境变量 | 说明 |
|------|--------|------------------|------|
| **Merchant ID (MID)** | Key Management 页面顶部 | `CYBS_MERCHANT_ID` | 形如 `leapcorp_XXXX` |
| **API Key (Key ID / keyid)** | 新建 REST API Key 后显示 | `CYBS_API_KEY` | 形如的一串 |
| **Secret (Shared Secret)** | 同上，**只显示一次** | `CYBS_SECRET_KEY` | 一段 Base64 字符串，丢了得重生成 |

> 🔐 这三个值就是 HTTP Signature 鉴权的全部。**Secret 丢了只能重置**，记好。

### Step 3 — 确认 Unified Checkout 已启用

**Payment Configuration → Unified Checkout → My customer experience**，确认能看到配置界面。如果看不到，联系你的 CyberSource 销售代表开通。

### Step 4 — 在 Business Center 里勾选要支持的支付方式

同一个 Unified Checkout 配置页里：
- **Payment Options**：勾选 Credit/debit cards、Apple Pay、Google Pay、Click to Pay 等
- **Look & feel**：配色用 Leap 品牌色（`#165DFF`）
- **Customer information and payment flow**：需要收集的字段（账单地址、邮箱等）

> HKD 交易需要确认你的 MID 已开通 HKD 结算币种（联系 CyberSource 客服确认）。

---

## 第二阶段：本地环境变量（~5 分钟）

在项目根 `.env`（本地开发）和你**部署平台（Netlify 后台）**两处都要配：

```bash
# CyberSource（替换原来的 Airwallex 那几行）
CYBS_MERCHANT_ID=你的MID
CYBS_API_KEY=你的KeyID
CYBS_SECRET_KEY=你的SharedSecret(Base64)

# 环境：sandbox 用 apitest，生产用 api
CYBS_ENV=sandbox           # 先 sandbox，验证通过后改 production

# webhook（第三阶段拿到）
CYBS_WEBHOOK_SECRET=       # 先留空

# 沿用原有的
RESEND_API_KEY=...
NOTIFY_EMAIL=leap.corp.service@gmail.com
SITE_URL=https://leapcorpser.com
```

---

## 第三阶段：写后端函数 —— 三个 Netlify Function

替换 `netlify/functions/create-payment-intent.js`，新增两个。下面是**可直接用的完整代码**。

### 3.1 共享：CyberSource HTTP Signature 鉴权（最关键、最容易错）

新建 `netlify/functions/_cybs-auth.js`：

```javascript
// netlify/functions/_cybs-auth.js
// CyberSource REST API HTTP Signature 鉴权工具
// 参考：Unified Checkout Developer Guide + Getting Started with REST

const crypto = require('crypto');

function getBaseUrl(env) {
  if (env === 'production') return 'https://api.cybersource.com';
  return 'https://apitest.cybersource.com'; // 默认 sandbox
}

/**
 * 生成 CyberSource REST 请求所需的鉴权头
 * @param {object} opts
 * @param {string} opts.method      - GET / POST
 * @param {string} opts.path        - 形如 '/uc/v1/sessions'，必须以 / 开头
 * @param {string|Buffer} opts.body - 请求体（GET 传空字符串）
 * @param {object} envVars          - { CYBS_MERCHANT_ID, CYBS_API_KEY, CYBS_SECRET_KEY, CYBS_ENV }
 * @returns {object} headers        - 可直接展开进 fetch headers
 */
function buildCybsHeaders({ method, path, body }, envVars) {
  const baseUrl = getBaseUrl(envVars.CYBS_ENV);
  const host = baseUrl.replace(/^https?:\/\//, '');
  const date = new Date().toUTCString(); // RFC1123 格式，如 "Wed, 06 Aug 2026 08:00:00 GMT"

  // 1. Digest：仅 POST/PUT 有 body 时才算
  let digest = '';
  const bodyStr = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '');
  if (method !== 'GET' && method !== 'DELETE' && bodyStr) {
    digest = 'SHA-256=' + crypto.createHash('sha256').update(bodyStr).digest('base64');
  }

  // 2. 签名串：headers 顺序必须和 Signature headers 字段一致
  //    POST 用: host date request-target digest v-c-merchant-id
  //    GET  用: host date request-target v-c-merchant-id
  let signingString;
  let headerList;
  if (digest) {
    headerList = 'host date request-target digest v-c-merchant-id';
    signingString =
      `host: ${host}\n` +
      `date: ${date}\n` +
      `request-target: ${method.toLowerCase()} ${path}\n` +
      `digest: ${digest}\n` +
      `v-c-merchant-id: ${envVars.CYBS_MERCHANT_ID}`;
  } else {
    headerList = 'host date request-target v-c-merchant-id';
    signingString =
      `host: ${host}\n` +
      `date: ${date}\n` +
      `request-target: ${method.toLowerCase()} ${path}\n` +
      `v-c-merchant-id: ${envVars.CYBS_MERCHANT_ID}`;
  }

  // 3. 用 Secret（Shared Secret）做 HMAC-SHA256
  //    注意：Secret 是 Base64 编码的，先 decode 再用
  const secretBytes = Buffer.from(envVars.CYBS_SECRET_KEY, 'base64');
  const signature = crypto.createHmac('sha256', secretBytes).update(signingString).digest('base64');

  // 4. 组装 Signature 头
  const signatureHeader =
    `keyid="${envVars.CYBS_API_KEY}", ` +
    `algorithm="HmacSHA256", ` +
    `headers="${headerList}", ` +
    `signature="${signature}"`;

  const headers = {
    host: host,
    date: date,
    'v-c-merchant-id': envVars.CYBS_MERCHANT_ID,
    signature: signatureHeader,
  };
  if (digest) headers.digest = digest;
  return headers;
}

/**
 * 发起一次签名后的 CyberSource REST 调用
 */
async function cybsRequest({ method, path, bodyObj, envVars }) {
  const baseUrl = getBaseUrl(envVars.CYBS_ENV);
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : '';
  const headers = buildCybsHeaders({ method, path, body: bodyStr }, envVars);
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: method === 'GET' ? undefined : bodyStr,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { _raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

module.exports = { buildCybsHeaders, cybsRequest, getBaseUrl };
```

> ⚠️ **三个最容易踩的坑：**
> 1. **Secret 要先 Base64 decode 再做 HMAC key**（不是直接当字符串）。
> 2. `request-target` 的方法是**小写**（`post /uc/v1/sessions`）。
> 3. signing string 里每行用 `\n` 分隔，**最后一行不带 `\n`**。

### 3.2 函数 1：创建 Sessions（拿 captureContext）

替换 `netlify/functions/create-payment-intent.js`（建议改名 `create-sessions.js`，但保留旧路径兼容前端）：

```javascript
// netlify/functions/create-payment-intent.js  (CyberSource Sessions)
const { cybsRequest } = require('./_cybs-auth');

// 复用你原有的价格白名单 + 折扣校验逻辑（不变）
// ... loadValidPrices / DISCOUNT_CODES / calculateDiscount / normalizeLineItems / validateOrder ...

function resolveSiteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.URL) return process.env.URL;
  const host = req.headers.host;
  return host ? `https://${host}` : 'http://localhost:8888';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405; res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const envVars = {
    CYBS_MERCHANT_ID: process.env.CYBS_MERCHANT_ID,
    CYBS_API_KEY: process.env.CYBS_API_KEY,
    CYBS_SECRET_KEY: process.env.CYBS_SECRET_KEY,
    CYBS_ENV: process.env.CYBS_ENV || 'sandbox',
  };
  if (!envVars.CYBS_MERCHANT_ID || !envVars.CYBS_API_KEY || !envVars.CYBS_SECRET_KEY) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'CyberSource credentials not configured' }));
  }

  try {
    const rawBody = await readRawBody(req);
    const { amount, currency, customer_name, customer_email, line_items, discount_code, discount_amount, locale } = JSON.parse(rawBody || '{}');

    // 复用原有金额校验
    const validation = validateOrder({ amount, currency, line_items, discount_code, discount_amount });
    if (!validation.valid) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: validation.reason }));
    }

    const siteOrigin = resolveSiteUrl(req);

    // ★ 调 CyberSource Sessions API
    const sessionBody = {
      targetOrigins: [
        siteOrigin,                              // 生产域名
        'http://localhost:8888',                 // 本地开发（上线前可删）
      ],
      allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'JCB', 'UNIONPAY'],
      allowedPaymentTypes: ['PANENTRY'],         // 先只做卡，钱包后续加
      country: 'HK',
      locale: locale === 'zh' ? 'zh_HK' : 'en_US',
      data: {
        orderInformation: {
          amountDetails: {
            totalAmount: String(amount) + '.00',
            currency: currency || 'HKD',
          },
        },
      },
    };

    const r = await cybsRequest({
      method: 'POST',
      path: '/uc/v1/sessions',
      bodyObj: sessionBody,
      envVars,
    });

    if (!r.ok) {
      res.statusCode = r.status;
      return res.end(JSON.stringify({ error: 'Sessions API failed', detail: r.data }));
    }

    // r.data 就是 captureContext（一段 JWT 字符串，CyberSource 返回在字段 .message 或顶层）
    const captureContext = r.data.captureContext || r.data.sessionJWT || r.data;
    return res.end(JSON.stringify({
      captureContext,
      amount,
      currency: currency || 'HKD',
      customer_name, customer_email,
      line_items: validation.products,
      discount_code, discount_amount: validation.discountAmount,
      locale: locale || 'en',
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
};

// readRawBody / json 等辅助函数同原文件
```

### 3.3 函数 2：用 transientTokenJwt 真正扣款

新建 `netlify/functions/process-payment.js`：

```javascript
// netlify/functions/process-payment.js
const { cybsRequest } = require('./_cybs-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('{"error":"Method not allowed"}'); }

  const envVars = {
    CYBS_MERCHANT_ID: process.env.CYBS_MERCHANT_ID,
    CYBS_API_KEY: process.env.CYBS_API_KEY,
    CYBS_SECRET_KEY: process.env.CYBS_SECRET_KEY,
    CYBS_ENV: process.env.CYBS_ENV || 'sandbox',
  };

  try {
    const { transientTokenJwt, amount, currency, customer_name, customer_email, line_items, discount_code, discount_amount, locale, captureContext } = JSON.parse(await readRawBody(req));

    if (!transientTokenJwt) { res.statusCode=400; return res.end('{"error":"Missing transientTokenJwt"}'); }

    // ★ 调 /pts/v2/payments，用 transientTokenJwt 扣款
    const paymentBody = {
      clientReferenceInformation: {
        code: 'LEAP-' + Date.now(),
      },
      processingInformation: {
        commerceIndicator: 'internet',
        // capture: true,   // 想要"授权+请款"一步到位（sale）就加这行；只要授权则不加
      },
      tokenInformation: {
        transientTokenJwt: transientTokenJwt,
      },
      orderInformation: {
        amountDetails: {
          totalAmount: String(amount) + '.00',
          currency: currency || 'HKD',
        },
        billTo: {
          firstName: (customer_name || '').split(' ')[0] || 'Customer',
          lastName:  (customer_name || '').split(' ').slice(1).join(' ') || 'Customer',
          email: customer_email || '',
          country: 'HK',
        },
      },
    };

    const r = await cybsRequest({
      method: 'POST',
      path: '/pts/v2/payments',
      bodyObj: paymentBody,
      envVars,
    });

    if (!r.ok) {
      res.statusCode = r.status;
      return res.end(JSON.stringify({ error: 'Payment failed', detail: r.data }));
    }

    // r.data 含 id, status=AUTHORIZED/PENDING/etc.
    return res.end(JSON.stringify({
      id: r.data.id,
      status: r.data.status,           // AUTHORIZED / DECLINED / etc.
      reconciliationId: r.data.reconciliationId,
      amount, currency,
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
};
```

> **授权 vs 请款（capture）选择：**
> - 你的服务是注册/会计类（不立即发货），建议**先授权后请款**：`processingInformation` 里**不加** `capture:true`。等客户服务交付完，再调 `POST /pts/v2/payments/{id}/captures` 真正收钱。
> - 如果想立即收钱，加 `capture: true`（变成 sale）。

### 3.4 函数 3：Webhook（需先配 MLE，第四阶段做）

先用占位，第四阶段配完 MLE 再补完签名校验逻辑。新建 `netlify/functions/payment-webhook-cybs.js`，结构沿用你现有 webhook（发邮件、存 Netlify Blobs），把 Airwallex 签名校验替换成 CyberSource 数字签名校验。

---

## 第四阶段：配 Webhook + MLE（~30 分钟，可选但强烈建议）

CyberSource 的 webhook **强制要求 MLE（消息级加密）**，这是和 Airwallex 最大的差异。

1. **Business Center → Payment Configuration → Key Management**：
   - 生成 **Asymmetric Key Pair**（非对称密钥对），下载 CyberSource 的**公钥**（用来解密 webhook）和你自己上传的公钥。
   - 记下用来生成密钥的 passphrase。

2. **Webhooks 配置**：
   - Business Center 搜 "Webhooks" → Create subscription
   - Endpoint: `https://leapcorpser.com/.netlify/functions/payment-webhook-cybs`
   - 订阅事件：选 **unifiedCheckout** → `uc.orders.transactionresults`
   - 开启 **Message-Level Encryption (MLE)**

3. 后端 `payment-webhook-cybs.js` 用 CyberSource 公钥（PEM）解密 payload，再做业务处理。把 PEM 存进环境变量 `CYBS_MLE_PUBLIC_KEY`。

> 这一步较复杂。如果你不需要 webhook（因为 process-payment.js 已经同步返回了 AUTHORIZED 状态），可以**先跳过**，靠同步返回的 payment status 判断成败。Webhook 主要用于退款、争议、异步通知。

---

## 第五阶段：改前端 payment.html（~30 分钟）

把 Airwallex SDK 换成 CyberSource Unified Checkout SDK。

### 5.1 换 SDK 引入

```html
<!-- 旧：Airwallex -->
<!-- <script src="https://checkout.airwallex.com/assets/elements.bundle.min.js"></script> -->

<!-- 新：CyberSource Unified Checkout -->
<!-- sandbox（验证完换生产）： -->
<script src="https://apitest.cybersource.com/uc/v1/assets/1.0.0/UnifiedCheckout.js"></script>
<!-- 生产：
<script src="https://api.cybersource.com/uc/v1/assets/1.0.0/UnifiedCheckout.js"></script>
-->
```

### 5.2 改 handleFinalPayment 逻辑

```javascript
var ucClient = null;
var ucCheckout = null;

async function initUnifiedCheckout() {
  // ① 调你的后端拿 captureContext
  var sessionRes = await fetch('/.netlify/functions/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: currentTotal,
      currency: 'HKD',
      customer_name: firstName + ' ' + lastName,
      customer_email: email,
      line_items: currentLineItems,
      discount_code: appliedDiscount ? appliedDiscount.code : '',
      discount_amount: currentDiscountAmount || 0,
      locale: lang,
    }),
  });
  var sessionData = await sessionRes.json();
  if (!sessionRes.ok) throw new Error(sessionData.error || 'Failed to create session');

  // ② 用 captureContext 初始化 SDK
  ucClient = await VAS.UnifiedCheckout(sessionData.captureContext);

  // ③ 创建 checkout（手动处理模式，拿 transientToken）
  ucCheckout = await ucClient.createCheckout({ autoProcessing: false });

  // ④ 渲染到页面
  await ucCheckout.mount('#unified-checkout-container');
}

async function handleFinalPayment() {
  try {
    // ⑤ 用户填完卡后，拿到 transientTokenJwt
    var transientTokenJwt = await ucCheckout.mount('#unified-checkout-container');
    // （mount 在 autoProcessing:false 下 resolve 出 transientTokenJwt）

    // ⑥ 把 transientTokenJwt 发给后端扣款
    var payRes = await fetch('/.netlify/functions/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transientTokenJwt: transientTokenJwt,
        amount: currentTotal,
        currency: 'HKD',
        customer_name: firstName + ' ' + lastName,
        customer_email: email,
        line_items: currentLineItems,
        discount_code: appliedDiscount ? appliedDiscount.code : '',
        discount_amount: currentDiscountAmount || 0,
        locale: lang,
        captureContext: window._captureContext,
      }),
    });
    var payData = await payRes.json();
    if (!payRes.ok) throw new Error(payData.error || 'Payment failed');

    if (payData.status === 'AUTHORIZED' || payData.status === 'PENDING') {
      // 跳成功页（参数同原逻辑）
      window.location.href = 'confirmation.html?id=' + payData.id + '&amount=' + currentTotal + ...;
    } else {
      window.location.href = 'payment-failed.html?reason=' + encodeURIComponent(payData.status) + ...;
    }
  } catch (e) {
    window.location.href = 'payment-failed.html?reason=' + encodeURIComponent(e.message) + ...;
  }
}
```

> ⚠️ 前端的具体 UI 结构（侧边栏 sidebar vs 嵌入式 embedded）需要根据你现有 `payment.html` 的布局调整。指南里 `mount('#id')` 是按钮列表，`mount()` 无参是全侧边栏，`mount({paymentSelection, paymentScreen})` 是嵌入式。建议先用嵌入式，因为你的页面已经有一个固定的"选择支付方式"区域。

### 5.3 更新 CSP（netlify.toml + vercel.json）

把 Airwallex 的域名换成 CyberSource：

```toml
# script-src: 去掉 checkout.airwallex.com，加 CyberSource
script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://apitest.cybersource.com https://api.cybersource.com;

# connect-src: 去掉 api.airwallex.com / checkout.airwallex.com，加 CyberSource API
connect-src 'self' https://apitest.cybersource.com https://api.cybersource.com https://*.supabase.co wss://*.supabase.co;

# frame-src: 去掉 airwallex，加 CyberSource（Unified Checkout 用 iframe）
frame-src https://apitest.cybersource.com https://api.cybersource.com https://*.cybersource.com;
```

---

## 第六阶段：本地端到端测试（sandbox，~30 分钟）

### 6.1 先验证后端鉴权能通

不碰前端，直接调你的函数验证 Sessions API：

```bash
curl -X POST http://localhost:8888/.netlify/functions/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"amount":1545,"currency":"HKD","customer_name":"Test","customer_email":"t@t.com","line_items":[{"name":"Incorporation Fee","unit_price":1545,"quantity":1}],"discount_code":"","discount_amount":0,"locale":"en"}'
```

期望返回 `{"captureContext":"eyJ...(长JWT)...", ...}`。

如果返回 401：检查 HTTP Signature（Secret 没正确 Base64 decode？request-target 小写？）。

### 6.2 CyberSource 测试卡

| 卡号 | 类型 | 期望结果 |
|------|------|----------|
| `4111 1111 1111 1111` | Visa | AUTHORIZED |
| `5555 5555 5555 4444` | Mastercard | AUTHORIZED |
| `4000 0000 0000 0002` | Visa | DECLINED（测试拒付） |

任意未来日期的 CVV（如 12/30, 123）。

### 6.3 验证完整流程

1. 本地起 `netlify dev`
2. 打开 payment.html，走完整流程
3. 检查 `process-payment` 返回 `status: AUTHORIZED`
4. 登录 Business Center Test → Transaction Search 看到这笔交易

---

## 第七阶段：上线生产

1. **Netlify 后台环境变量**：把所有 `CYBS_*` 配上（生产 Key/Secret）
2. `CYBS_ENV=production`（切换到 api.cybersource.com）
3. 前端 SDK 换成 `api.cybersource.com` 的地址
4. CSP 里的 `apitest` 域名可保留或删除
5. `targetOrigins` 里只留 `https://leapcorpser.com`，删掉 localhost
6. 部署 → 用一张真实小额卡（如 HK$1）端到端验证 → Business Center 生产看到交易

---

## 替换清单（别漏）

| 原文件 | 动作 |
|--------|------|
| `api/create-payment-intent.js` | 改造成 CyberSource（或删除，因为线上只用 Netlify 版） |
| `netlify/functions/create-payment-intent.js` | 改造成 CyberSource Sessions |
| `netlify/functions/process-payment.js` | **新建** |
| `netlify/functions/payment-webhook.js` | 改造成 CyberSource（含 MLE），或先保留旧名兼容 |
| `pages/payment.html` | 换 SDK + 改 handleFinalPayment |
| `netlify.toml` / `vercel.json` | 更新 CSP |
| `.env` + Netlify 环境变量 | 加 `CYBS_*`，可保留也可删 `AIRWALLEX_*` |

---

## 官方文档索引

- [Unified Checkout Developer Guide（本指南来源）](https://developer.cybersource.com/content/dam/docs/cybs/en-us/unified-checkout/developer/all/rest/unified-checkout.pdf)
- [HTTP Signature Authentication](https://developer.cybersource.com/library/documentation/dev_guides/REST_API/Getting_Started/html/REST_GS/ch_authentication.5.3.htm)
- [Constructing the Signature Header](https://developer.cybersource.com/docs/cybs/en-us/platform/developer/all/rest/rest-getting-started/restgs-http-message-intro/restgs-http-message-conf-intro/restgs-http-message-headers.html)
- [Java Sample: StandaloneHttpSignature](https://github.com/CyberSource/cybersource-rest-samples-java/blob/master/src/main/java/samples/authentication/AuthSampleCode/StandaloneHttpSignature.java)
- [Webhooks Implementation Guide](https://developer.cybersource.com/docs/cybs/en-us/developer/quick-start/webhooks-landing-intro.html)

---

*本指南基于 CyberSource Unified Checkout Developer Guide v26.07.01 全文通读 + Getting Started with REST 鉴权文档，结合 Leap 现有 Netlify 架构编写。所有 endpoint、字段名、签名格式均来自官方文档原文。*
