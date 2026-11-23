(function () {
  'use strict';
  function update() {
    var data = document.getElementById('leap-page-metadata');
    if (!data) return;
    var lang = document.documentElement.getAttribute('data-lang') || document.documentElement.lang || 'en';
    lang = lang === 'zh-HK' ? 'zh-Hant' : lang === 'zh-CN' ? 'zh-Hans' : lang;
    if (/\/(payment|payment-failed|confirmation|stripe-return)(\.html)?$/.test(location.pathname)) {
      var heading = document.querySelector('h1');
      if (heading && heading.textContent.trim()) document.title = heading.textContent.trim() + ' | Leap International';
      return;
    }
    var metadata = JSON.parse(data.textContent)[lang];
    if (!metadata) return;
    if (metadata.title) document.title = metadata.title;
    [['meta[name="description"]', metadata.description], ['meta[property="og:title"]', metadata.title], ['meta[property="og:description"]', metadata.description], ['meta[name="twitter:title"]', metadata.title], ['meta[name="twitter:description"]', metadata.description]].forEach(function (item) {
      var node = document.querySelector(item[0]); if (node && item[1]) node.content = item[1];
    });
    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.content = lang === 'zh-Hant' ? 'zh_HK' : lang === 'zh-Hans' ? 'zh_CN' : 'en_HK';
  }
  document.addEventListener('langchange', update);
  document.addEventListener('change', function (event) { if (event.target.id === 'languageSelect') update(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update); else update();
})();
