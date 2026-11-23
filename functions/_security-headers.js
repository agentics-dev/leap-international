// Shared by Pages middleware and the local preview server.
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://js.stripe.com https://*.cybersource.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.stripe.com https://m.stripe.network https://*.cybersource.com https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com",
    "frame-src 'self' https://*.stripe.com https://*.cybersource.com",
    "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self' https://*.cybersource.com",
  ].join('; '),
};
module.exports = function securityHeaders(secure) {
  return secure ? { ...headers, 'Strict-Transport-Security': 'max-age=31536000' } : { ...headers };
};
