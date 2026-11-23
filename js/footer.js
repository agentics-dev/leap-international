(function () {
  'use strict';
  var footer = document.querySelector('.site-footer');
  if (!footer) return;
  footer.querySelector('[data-footer-year]').textContent = new Date().getFullYear();
  function updateLinks() {
    var value = document.documentElement.getAttribute('data-lang') || document.documentElement.lang;
    var lang = /^(zh-Hant|zh-HK)$/.test(value) ? 'zh-Hant' : /^(zh-Hans|zh-CN)$/.test(value) ? 'zh-Hans' : 'en';
    footer.querySelectorAll('a[data-footer-page]').forEach(function (link) {
      var url = new URL(link.href);
      url.searchParams.set('lang', lang);
      link.href = url.pathname + url.search;
    });
  }
  updateLinks();
  new MutationObserver(updateLinks).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-lang'] });
})();
