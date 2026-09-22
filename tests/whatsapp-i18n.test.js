const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const i18n = fs.readFileSync(path.join(root, 'js/i18n.js'), 'utf8');

function openPage(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const href = html.match(/<a href="(https:\/\/wa\.me\/[^\"]+)"[^>]*class="whatsapp-float"/)[1];
  const dom = new JSDOM(`<a class="whatsapp-float" href="${href}"></a>`, {
    url: 'https://leapcorpser.com/',
    runScripts: 'outside-only',
  });
  dom.window.eval(i18n);
  return dom.window;
}

for (const [file, expected] of [
  ['index.html', {
    en: "Hi Leap International, I'd like to enquire about your services.",
    'zh-Hant': '您好，我想查詢溱柏的服務。',
    'zh-Hans': '您好，我想咨询溱柏的服务。',
  }],
  ['pages/audit-tax-filing.html', {
    en: "Hi Leap International, I'd like to enquire about your Audit & Tax Filing services.",
    'zh-Hant': '您好，我想查詢溱柏的審計及報稅服務。',
    'zh-Hans': '您好，我想咨询溱柏的审计及报税服务。',
  }],
]) {
  test(`${file} WhatsApp message follows language switches`, () => {
    const window = openPage(file);
    for (const lang of ['zh-Hant', 'zh-Hans', 'en']) {
      window.setLang(lang);
      const url = new URL(window.document.querySelector('.whatsapp-float').href);
      assert.equal(url.hostname, 'api.whatsapp.com');
      assert.equal(url.pathname, '/send');
      assert.equal(url.searchParams.get('phone'), '85265550943');
      assert.equal(url.searchParams.get('text'), expected[lang]);
      assert.equal(url.searchParams.get('lang'), {
        'zh-Hant': 'zh_HK',
        'zh-Hans': 'zh_CN',
        en: 'en',
      }[lang]);
    }
    window.close();
  });
}
