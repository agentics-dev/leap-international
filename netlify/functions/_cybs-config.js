// netlify/functions/_cybs-config.js
// CyberSource 商户配置（凭证 + 环境）。
// 参照官方 cybersource-unified-checkout-sample-node 的 Data/Configuration.js，
// 改成从环境变量读取，方便 Netlify Functions 部署。

const RUN_ENV_SANDBOX = 'apitest.cybersource.com';
const RUN_ENV_PROD = 'api.cybersource.com';

/**
 * 返回 SDK 需要的配置对象。
 * 环境变量：
 *   CYBS_MERCHANT_ID  - 商户号
 *   CYBS_API_KEY      - REST API Key ID
 *   CYBS_SECRET_KEY   - REST API Shared Secret（Base64）
 *   CYBS_ENV          - 'sandbox' | 'production'（默认 sandbox）
 */
function getConfig() {
  const env = (process.env.CYBS_ENV || 'sandbox').toLowerCase();
  const runEnvironment = env === 'production' ? RUN_ENV_PROD : RUN_ENV_SANDBOX;

  const merchantID = process.env.CYBS_MERCHANT_ID;
  const merchantKeyId = process.env.CYBS_API_KEY;
  const merchantsecretKey = process.env.CYBS_SECRET_KEY;

  if (!merchantID || !merchantKeyId || !merchantsecretKey) {
    throw new Error(
      'CyberSource credentials not configured. Set CYBS_MERCHANT_ID, CYBS_API_KEY, CYBS_SECRET_KEY.'
    );
  }

  return {
    authenticationType: 'http_signature',
    runEnvironment,
    merchantID,
    merchantKeyId,
    merchantsecretKey,
    useMetaKey: false,
    portfolioID: '',
    logConfiguration: {
      enableLog: false, // 函数日志关闭，避免 Netlify 临时文件系统问题
      loggingLevel: 'error',
    },
  };
}

function isProduction() {
  return (process.env.CYBS_ENV || 'sandbox').toLowerCase() === 'production';
}

/** JWKS / SDK 资源对应的环境域名，供 _cybs-token.js 验签用 */
function getFlexHost() {
  return isProduction() ? 'flex.cybersource.com' : 'testflex.cybersource.com';
}

module.exports = { getConfig, isProduction, getFlexHost, RUN_ENV_SANDBOX, RUN_ENV_PROD };
