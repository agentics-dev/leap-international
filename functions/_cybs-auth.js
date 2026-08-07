// functions/_cybs-auth.js
// CyberSource HTTP Signature 鉴权（Cloudflare Workers 版）。
// 用 Web Crypto API（SubtleCrypto），不依赖 Node 的 crypto 模块。
//
// 三个要点：
//   1. Secret 是 Base64，先 decode 成字节再做 HMAC key
//   2. request-target 方法小写：post /up/v1/capture-contexts
//   3. 签名串每行 \n 分隔，最后一行不带 \n

function getBaseUrl(env) {
  // env 是 Cloudflare 的环境变量对象（context.env）
  if (env.CYBS_ENV === 'production') return 'https://api.cybersource.com';
  return 'https://apitest.cybersource.com';
}

// Base64 → 字节（Workers 无 Buffer.from(str,'base64')，用 atob）
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 字节 → Base64（用 btoa）
function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// SHA-256(body) → Base64
async function sha256Base64(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64(new Uint8Array(hash));
}

// HMAC-SHA256(message, keyBytes) → Base64
async function hmacSha256Base64(message, keyBytes) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(sig));
}

/**
 * 发起一次签名后的 CyberSource REST 调用。
 * @param {object} opts - { method, path, body(obj), env }
 * @returns {Promise<{ok, status, data}>}
 */
async function cybsRequest({ method, path, body, env }) {
  const baseUrl = getBaseUrl(env);
  const host = baseUrl.replace(/^https?:\/\//, '');
  const date = new Date().toUTCString();
  const bodyStr = body == null ? '' : JSON.stringify(body);
  const hasBody = method !== 'GET' && method !== 'DELETE' && !!bodyStr;

  // 1. Digest
  let digest = '';
  if (hasBody) digest = 'SHA-256=' + (await sha256Base64(bodyStr));

  // 2. 签名串
  let headerList, signingString;
  if (hasBody) {
    headerList = 'host date request-target digest v-c-merchant-id';
    signingString = [
      `host: ${host}`,
      `date: ${date}`,
      `request-target: ${method.toLowerCase()} ${path}`,
      `digest: ${digest}`,
      `v-c-merchant-id: ${env.CYBS_MERCHANT_ID}`,
    ].join('\n');
  } else {
    headerList = 'host date request-target v-c-merchant-id';
    signingString = [
      `host: ${host}`,
      `date: ${date}`,
      `request-target: ${method.toLowerCase()} ${path}`,
      `v-c-merchant-id: ${env.CYBS_MERCHANT_ID}`,
    ].join('\n');
  }

  // 3. HMAC
  const secretBytes = base64ToBytes(env.CYBS_SECRET_KEY);
  const signature = await hmacSha256Base64(signingString, secretBytes);

  const signatureHeader =
    `keyid="${env.CYBS_API_KEY}", ` +
    `algorithm="HmacSHA256", ` +
    `headers="${headerList}", ` +
    `signature="${signature}"`;

  // 4. 发请求（Workers 原生 fetch）
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/jwt',
    host: host,
    date: date,
    'v-c-merchant-id': env.CYBS_MERCHANT_ID,
    signature: signatureHeader,
  };
  if (hasBody) headers.digest = digest;

  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: hasBody ? bodyStr : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : '';
  } catch (e) {
    data = text; // captureContext 返回的是 JWT 字符串，不是 JSON
  }
  return { ok: res.ok, status: res.status, data };
}

module.exports = { cybsRequest, getBaseUrl };
