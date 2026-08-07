// functions/_cybs-token.js
// CyberSource JWT 验签（Cloudflare Workers 版）。
// 用 Web Crypto API 的 RS256 验签 + 原生 fetch 取 JWKS，不依赖 jsonwebtoken / jwk-to-pem。
//
// 安全要点：
//   - 只接受 RS256，拒绝 none 和对称算法（HS*）
//   - 用 CyberSource 公钥（JWKS）验签，不信任前端 payload

const ALLOWED_ALGORITHMS = ['RS256'];
const ALLOWED_CLIENT_LIBRARY_HOSTS = new Set([
  'flex.cybersource.com',
  'testflex.cybersource.com',
  'flex.test.cybersource.com',
  'testup.cybersource.com',
  'up.cybersource.com',
]);

function getFlexHost(env) {
  return env && env.CYBS_ENV === 'production' ? 'flex.cybersource.com' : 'testflex.cybersource.com';
}

// 简易 JWT 解码（不验签，仅取 header/payload）
function decodeJWT(token) {
  if (typeof token !== 'string') throw new Error('Token must be a string');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const header = JSON.parse(atob(parts[0]));
  const payload = JSON.parse(atob(parts[1]));
  return { header, payload };
}

// Base64URL → 字节
function b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// JWK → Web Crypto Key（用于 RS256 验签）
async function jwkToCryptoKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

const jwkCache = new Map(); // key: host:kid, value: { key, expiresAt }
const JWK_CACHE_TTL = 60 * 60 * 1000;

async function getCyberSourcePublicKey(kid, env) {
  const host = getFlexHost(env);
  const cacheKey = `${host}:${kid}`;
  const cached = jwkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.key;

  if (!/^[A-Za-z0-9_\-]{1,128}$/.test(kid)) throw new Error('Invalid kid');
  const res = await fetch(`https://${host}/flex/v2/public-keys/${encodeURIComponent(kid)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`JWKS fetch HTTP ${res.status}`);
  const jwk = await res.json();
  if (!jwk || !jwk.kty) throw new Error('Invalid JWK');
  const key = await jwkToCryptoKey(jwk);
  jwkCache.set(cacheKey, { key, expiresAt: Date.now() + JWK_CACHE_TTL });
  return key;
}

/**
 * 验证并解码 CyberSource 签发的 JWT。
 * @param {string} token
 * @param {object} env - Cloudflare 环境变量
 * @returns {Promise<object>} verified payload
 */
async function verifyAndDecodeToken(token, env) {
  if (!token || typeof token !== 'string') throw new Error('Token required');
  const { header, payload } = decodeJWT(token);
  if (!header || typeof header.alg !== 'string') throw new Error('Missing alg in header');

  const alg = header.alg.toUpperCase();
  if (alg === 'NONE' || alg.startsWith('HS') || !ALLOWED_ALGORITHMS.includes(alg)) {
    throw new Error(`Disallowed algorithm: ${header.alg}`);
  }
  if (!header.kid) throw new Error('Missing kid in header');

  const publicKey = await getCyberSourcePublicKey(header.kid, env);
  const parts = token.split('.');
  const signingInput = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const signature = b64urlToBytes(parts[2]);

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signingInput);
  if (!valid) throw new Error('Signature verification failed');
  return payload;
}

module.exports = {
  verifyAndDecodeToken,
  ALLOWED_CLIENT_LIBRARY_HOSTS,
};
