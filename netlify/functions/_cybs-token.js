// netlify/functions/_cybs-token.js
// CyberSource JWT 验签工具。
// 参照官方 cybersource-unified-checkout-sample-node/validation/TokenValidator.js，
// 用于校验：
//   1. captureContext JWT（前端拿到后不能直接信，服务端要验签解出 clientLibrary）
//   2. completeResponse JWT（前端付款返回的 JWT，服务端验签后才能信里面的付款结果）
//
// 安全要点：
//   - 只接受 RS256，拒绝 none 和对称算法（HS*），防 algorithm-confusion 攻击
//   - 用 CyberSource 公钥（JWKS endpoint）验签，不信任前端传来的 payload
//   - clientLibrary URL 必须落在 CyberSource 域名白名单里，防注入恶意脚本

const https = require('https');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const { getFlexHost } = require('./_cybs-config');

const ALLOWED_ALGORITHMS = ['RS256'];

// 允许下发 SDK 脚本的 CyberSource 域名（防注入）
const ALLOWED_CLIENT_LIBRARY_HOSTS = new Set([
  'flex.cybersource.com',
  'testflex.cybersource.com',
  'flex.test.cybersource.com',
]);

const JWK_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时
const jwkCache = new Map();

function decodeJWT(token) {
  if (typeof token !== 'string') throw new Error('Token must be a string');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return { header, payload };
}

function fetchJwk(host, kid) {
  return new Promise((resolve, reject) => {
    if (!/^[A-Za-z0-9_\-]{1,128}$/.test(kid)) return reject(new Error('Invalid kid'));
    const req = https.request(
      { host, path: `/flex/v2/public-keys/${encodeURIComponent(kid)}`, method: 'GET', timeout: 5000, headers: { Accept: 'application/json' } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`JWKS fetch HTTP ${res.statusCode}`));
          try {
            const parsed = JSON.parse(body);
            if (!parsed || !parsed.kty) return reject(new Error('Invalid JWK'));
            resolve(parsed);
          } catch (e) {
            reject(new Error(`JWK parse: ${e.message}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('JWKS timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function getCyberSourcePublicKey(kid) {
  const host = getFlexHost();
  const cacheKey = `${host}:${kid}`;
  const cached = jwkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.pem;
  const jwk = await fetchJwk(host, kid);
  const pem = jwkToPem(jwk);
  jwkCache.set(cacheKey, { pem, expiresAt: Date.now() + JWK_CACHE_TTL_MS });
  return pem;
}

/**
 * 验证并解码 CyberSource 签发的 JWT（captureContext 或 completeResponse）。
 * @returns {Promise<object>} verified payload
 */
async function verifyAndDecodeToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Token required');
  const { header } = decodeJWT(token);
  if (!header || typeof header.alg !== 'string') throw new Error('Missing alg in header');

  const alg = header.alg.toUpperCase();
  if (alg === 'NONE' || alg.startsWith('HS') || !ALLOWED_ALGORITHMS.includes(alg)) {
    throw new Error(`Disallowed algorithm: ${header.alg}`);
  }
  if (!header.kid) throw new Error('Missing kid in header');

  const publicKey = await getCyberSourcePublicKey(header.kid);
  try {
    return jwt.verify(token, publicKey, { algorithms: ALLOWED_ALGORITHMS });
  } catch (e) {
    throw new Error(`Signature verification failed: ${e.message}`);
  }
}

/**
 * 从 captureContext JWT 解出 clientLibrary（SDK 脚本 URL）和 integrity hash。
 * 前端用这两个动态加载 SDK，不写死 URL。
 */
async function extractClientLibraryFromCaptureContext(captureContextToken) {
  const payload = await verifyAndDecodeToken(captureContextToken);
  if (!payload || !Array.isArray(payload.ctx) || !payload.ctx[0] || !payload.ctx[0].data) {
    throw new Error('Invalid capture context payload');
  }
  const { clientLibrary, clientLibraryIntegrity } = payload.ctx[0].data;
  if (!clientLibrary || typeof clientLibrary !== 'string') {
    throw new Error('Missing clientLibrary in capture context');
  }
  const url = new URL(clientLibrary);
  if (url.protocol !== 'https:') throw new Error('clientLibrary must be https');
  if (!ALLOWED_CLIENT_LIBRARY_HOSTS.has(url.hostname)) {
    throw new Error(`clientLibrary host not allowed: ${url.hostname}`);
  }
  return { clientLibrary, clientLibraryIntegrity: clientLibraryIntegrity || '' };
}

module.exports = {
  verifyAndDecodeToken,
  extractClientLibraryFromCaptureContext,
  ALLOWED_CLIENT_LIBRARY_HOSTS,
};
