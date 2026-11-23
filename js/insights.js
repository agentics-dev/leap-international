(function () {
  function reflectLanguage() {
    const lang = window.currentLang();
    const page = document.querySelector('main.insight-shell');
    const heading = page.querySelector('h1 [lang="' + lang + '"]').textContent;
    const title = (lang === 'en' ? page.dataset.titleEn : heading) + ' | Leap International';
    const description = page.getAttribute('data-description-' + lang.toLowerCase());
    document.title = title;
    document.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]').forEach(el => { el.content = title; });
    document.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]').forEach(el => { el.content = description; });
    page.querySelectorAll('a[data-insight-link]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('lang', lang);
      link.href = url.pathname + url.search;
    });
  }
  reflectLanguage();
  document.addEventListener('langchange', reflectLanguage);
})();
