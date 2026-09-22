const TOKEN_TTL_SECONDS = 15 * 60;

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importHmacKey(secret, usage) {
  if (!secret || String(secret).length < 32) throw new Error('PAYMENT_RECEIPT_SECRET is not configured');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  );
}

async function signReceipt(receipt, secret, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload = { ...receipt, iat: issuedAt, exp: issuedAt + TOKEN_TTL_SECONDS };
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function verifyReceipt(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 8192) throw new Error('Invalid receipt token');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Invalid receipt token');

  const key = await importHmacKey(secret, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, decodeBase64Url(parts[1]), new TextEncoder().encode(parts[0]));
  if (!valid) throw new Error('Invalid receipt signature');

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  } catch (error) {
    throw new Error('Invalid receipt payload');
  }
  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= nowSeconds) {
    throw new Error('Receipt token has expired');
  }
  if (payload.iat > nowSeconds + 60 || payload.exp - payload.iat > TOKEN_TTL_SECONDS) {
    throw new Error('Invalid receipt lifetime');
  }
  return payload;
}

module.exports = { TOKEN_TTL_SECONDS, signReceipt, verifyReceipt };
