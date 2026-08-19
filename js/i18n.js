// js/i18n.js
// 共享 i18n 脚本：三语切换（English / 繁體 / 简体）。
// 简体中文由 scripts/generate-simplified.js 预生成，直接嵌入 HTML（零延迟，不依赖 CDN）。
//
// 设计原则：
// - CSS 用 !important 确保三态互斥（不依赖加载顺序）
// - 事件用 document 委托（不依赖 init() 时机，任何时刻点按钮都能响应）

(function () {
  'use strict';

  var LANG_KEY = 'leap-lang';

  function normaliseLang(v) {
    if (v === 'zh' || v === 'zh-Hant') return 'zh-Hant';
    if (v === 'zh-Hans' || v === 'zh-CN' || v === 'cn') return 'zh-Hans';
    return 'en';
  }

  window.currentLang = function () {
    return document.documentElement.getAttribute('data-lang') || 'en';
  };
  window.isZh = function () {
    var l = window.currentLang();
    return l === 'zh-Hant' || l === 'zh-Hans';
  };

  // 注入 CSS（立即执行，不等 DOMContentLoaded）
  function injectStyles() {
    if (document.getElementById('i18n-styles')) return;
    var style = document.createElement('style');
    style.id = 'i18n-styles';
    style.textContent = `
/* ===== i18n 三语显示控制 ===== */
/* 默认隐藏所有中文，只显示英文 */
.lang-zh, .lang-zh-Hans { display: none !important; }

/* 英文模式 */
html[data-lang="en"] .lang-en { display: revert !important; }
html[data-lang="en"] .lang-zh, html[data-lang="en"] .lang-zh-Hans { display: none !important; }

/* 繁体模式：只显示 .lang-zh */
html[data-lang="zh-Hant"] .lang-en, html[data-lang="zh-Hant"] .lang-zh-Hans { display: none !important; }
html[data-lang="zh-Hant"] .lang-zh { display: revert !important; }

/* 简体模式：只显示 .lang-zh-Hans */
html[data-lang="zh-Hans"] .lang-en, html[data-lang="zh-Hans"] .lang-zh { display: none !important; }
html[data-lang="zh-Hans"] .lang-zh-Hans { display: revert !important; }

/* ===== 导航栏放大 30% ===== */
header.bg-nav-bg > div { padding-top: 16px !important; padding-bottom: 16px !important; }
header.bg-nav-bg img[alt="FOI Logo"] { height: 62px !important; }
header.bg-nav-bg .mega-primary-link,
header.bg-nav-bg nav > a,
header.bg-nav-bg #langBtn { font-size: 17px !important; padding-top: 10px !important; padding-bottom: 10px !important; }
header.bg-nav-bg .mega-toggle .material-symbols-outlined { font-size: 23px !important; width: 23px !important; }
header.bg-nav-bg #menuToggle svg { width: 30px !important; height: 30px !important; }
header.bg-nav-bg .lang-dropdown-option { font-size: 15px !important; }
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function updateSwitcherUI(lang) {
    var flag = document.getElementById('langFlag');
    var label = document.getElementById('langLabel');
    if (!flag || !label) return;
    if (lang === 'zh-Hant') { flag.textContent = '🇭🇰'; label.textContent = '繁體'; }
    else if (lang === 'zh-Hans') { flag.textContent = '🇨🇳'; label.textContent = '简体'; }
    else { flag.textContent = '🇬🇧'; label.textContent = 'EN'; }
  }

  // 把当前语言写入地址栏 ?lang=（不刷新页面），形成可分享的三语链接
  function updateUrlLang(v) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('lang', v);
      window.history.replaceState({}, '', url);
    } catch (e) {}
  }

  // SEO：注入 hreflang（en / zh-Hant / zh-Hans / x-default 互链）
  function injectHreflang() {
    if (document.getElementById('leap-hreflang')) return;
    try {
      ['en', 'zh-Hant', 'zh-Hans', 'x-default'].forEach(function (lg) {
        var link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = lg;
        var u = new URL(window.location.href);
        if (lg === 'x-default') u.searchParams.delete('lang');
        else u.searchParams.set('lang', lg);
        link.href = u.toString();
        document.head.appendChild(link);
      });
      var mark = document.createElement('span');
      mark.id = 'leap-hreflang';
      mark.style.display = 'none';
      document.head.appendChild(mark);
    } catch (e) {}
  }

  window.setLang = function (lang) {
    try {
      var html = document.documentElement;
      var v = normaliseLang(lang);
      html.setAttribute('data-lang', v);
      html.setAttribute('lang', v === 'zh-Hant' ? 'zh-Hant' : v === 'zh-Hans' ? 'zh-Hans' : 'en');
      updateSwitcherUI(v);
      try { localStorage.setItem(LANG_KEY, v); } catch (e) {}
      updateUrlLang(v);
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: v } }));
    } catch (e) {
      console.error('setLang error:', e);
    }
  };

  window.normaliseLang = normaliseLang;

  // ====== 立即执行（不等 DOMContentLoaded）======
  injectStyles();
  injectHreflang();

  // 设置初始语言（从 localStorage 或 URL ?lang=）
  try {
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get('lang');
    var savedLang = 'en';
    try { savedLang = normaliseLang(localStorage.getItem(LANG_KEY)); } catch (e) {}
    window.setLang(urlLang || savedLang);
  } catch (e) {
    console.error('i18n initial setLang error:', e);
  }

  // ====== 事件委托：监听 document 的 click（不依赖 DOM 时机）======
  // 这样无论按钮何时出现在 DOM 里，点击都能被捕获
  // 注意：必须用 closest('button[data-lang]') 精确匹配——
  // setLang 会在 <html> 上设置 data-lang，若向上遍历找 [data-lang] 会误命中
  // <html>，导致全站每次点击都被 preventDefault（checkbox/radio 打不上勾）。
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('button[data-lang]') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    window.setLang(el.getAttribute('data-lang'));
    // 关闭下拉菜单
    var dropdown = document.getElementById('langDropdown');
    if (dropdown) dropdown.classList.remove('show');
    var langBtn = document.getElementById('langBtn');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
  }, true); // ← 捕获阶段，确保在页面的 document click handler 之前执行
})();

// ========== Mega Menu 切换（inline onclick 用，最可靠）==========
window.toggleMegaMenu = function(el) {
  var parent = el.closest('.mega-group');
  if (!parent) return;
  var isOpen = parent.classList.contains('show');
  document.querySelectorAll('.mega-group').forEach(function(g) { g.classList.remove('show'); });
  if (!isOpen) parent.classList.add('show');
};

// ========== HTML 转义工具（全站共享，防 XSS）==========
window.escapeHtml = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
