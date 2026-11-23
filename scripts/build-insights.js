// Publish the supplied articles as ordinary static pages using the site's navigation.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const articles = require('../content/insights.json');

const languages = { en: 'lang-en', 'zh-Hant': 'lang-zh', 'zh-Hans': 'lang-zh-Hans' };
const labels = { en: 'Insights', 'zh-Hant': '資訊', 'zh-Hans': '资讯' };
const introductions = {
  en: 'Practical guides to registering, banking and staying compliant in Hong Kong.',
  'zh-Hant': '香港公司註冊、銀行開戶與日常合規指南。',
  'zh-Hans': '香港公司注册、银行开户与日常合规指南。'
};
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function localized(tag, render) {
  return Object.entries(languages).map(([lang, css]) =>
    `<${tag} class="${css}" lang="${lang}">${render(lang)}</${tag}>`
  ).join('');
}

function paragraphText(text) {
  return escapeHtml(text).replace(/\btcsp\.cr\.gov\.hk\b/g,
    '<a href="https://tcsp.cr.gov.hk/" target="_blank" rel="noopener noreferrer">tcsp.cr.gov.hk</a>');
}

function renderBlocks(blocks) {
  return blocks.map(block => {
    if (block.items) {
      return `<${block.type}>${block.items.map(item => `<li>${paragraphText(item)}</li>`).join('')}</${block.type}>`;
    }
    if (block.type === 'h2') return `<h2>${paragraphText(block.text)}</h2>`;
    return `<p class="insight-${block.type}">${paragraphText(block.text)}</p>`;
  }).join('\n');
}

function cover(article, kind = 'cover') {
  return `/images/insights/${article.slug}-${kind}.webp`;
}

function excerpt(article, lang) {
  return article.translations[lang].blocks.find(block => block.type === 'p').text;
}

function articlePath(article) {
  return `/pages/insight-${article.slug}.html`;
}

function listing() {
  const cards = articles.map(article => `
    <a class="insight-card" data-insight-link href="${articlePath(article)}">
      <div class="insight-card-photo"><img src="${cover(article)}" alt="" width="1000" height="563" loading="lazy"></div>
      <div class="insight-card-copy">
        <h2>${localized('span', lang => escapeHtml(article.translations[lang].title))}</h2>
        <div class="insight-excerpt">${localized('p', lang => escapeHtml(excerpt(article, lang)))}</div>
      </div>
    </a>`).join('\n');
  return `<main class="insight-shell insight-index"><div class="insight-width">
    <header class="insight-intro"><h1>${localized('span', lang => labels[lang])}</h1>
    <p>${localized('span', lang => introductions[lang])}</p></header>
    <div class="insight-grid">${cards}</div></div></main>`;
}

function detail(article) {
  const texts = article.translations;
  return `<main class="insight-shell insight-detail"><div class="insight-width">
    <a class="insight-back" data-insight-link href="/pages/insights.html"><span aria-hidden="true">←</span> ${localized('span', lang => labels[lang])}</a>
    <article class="insight-layout">
      <h1>${localized('span', lang => escapeHtml(texts[lang].title))}</h1>
      <figure class="insight-media">
        <img src="${cover(article, 'poster')}" alt="" width="950" height="1250">
      </figure>
      <div class="insight-body">${localized('div', lang => renderBlocks(texts[lang].blocks))}</div>
    </article></div></main>`;
}

function buildInsights(dist) {
  const { document } = new JSDOM(fs.readFileSync(path.join(dist, 'pages/news.html'), 'utf8')).window;
  const main = document.querySelector('main');
  const whatsapp = document.querySelector('a.whatsapp-float');
  whatsapp.setAttribute('data-whatsapp-topic', 'general');
  whatsapp.href = 'https://wa.me/85265550943';
  const footer = document.querySelector('footer');
  const navigation = [...document.body.children].slice(0, [...document.body.children].indexOf(main));
  document.body.replaceChildren(...navigation, main, footer, whatsapp);
  document.querySelectorAll('script[type="application/ld+json"],script[src*="opencc-t2cn"],meta[name="keywords"]').forEach(el => el.remove());
  document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/js/insights.css"><script defer src="/js/insights.js"></script>');

  function write(url, content, title, description, image) {
    const pageUrl = new URL(url, document.querySelector('link[rel="canonical"]').href);
    document.querySelector('link[rel="canonical"]').href = pageUrl.href;
    document.title = title.en + ' | Leap International';
    document.querySelector('meta[name="description"]').content = description.en;
    document.querySelector('meta[property="og:url"]').content = pageUrl.href;
    document.querySelector('meta[property="og:image"]').content = new URL(image, pageUrl).href;
    document.querySelector('meta[property="og:type"]').content = url === '/pages/insights.html' ? 'website' : 'article';
    for (const name of ['og', 'twitter']) {
      document.querySelector(`meta[${name === 'og' ? 'property' : 'name'}="${name}:title"]`).content = document.title;
      document.querySelector(`meta[${name === 'og' ? 'property' : 'name'}="${name}:description"]`).content = description.en;
    }
    document.querySelector('main').outerHTML = content;
    document.querySelectorAll('header nav a[href="/pages/insights.html"], #mobileMenu a[href="/pages/insights.html"]').forEach(link => {
      link.setAttribute('aria-current', url === '/pages/insights.html' ? 'page' : 'location');
    });
    const region = document.querySelector('main');
    region.setAttribute('data-title-en', title.en);
    for (const lang of Object.keys(languages)) {
      region.setAttribute('data-description-' + lang.toLowerCase(), description[lang]);
    }
    fs.writeFileSync(path.join(dist, url), '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
  }
  write('/pages/insights.html', listing(), { ...labels, en: 'Hong Kong Business Insights' }, {
    ...introductions, en: 'Browse practical guides to Hong Kong company registration, annual compliance, company secretary licences and business banking for founders and overseas owners.'
  }, cover(articles[0]));
  for (const article of articles) {
    const titles = {}, descriptions = {};
    for (const lang of Object.keys(languages)) {
      titles[lang] = article.translations[lang].pageTitle || article.translations[lang].title;
      descriptions[lang] = article.translations[lang].description || excerpt(article, lang);
    }
    write(articlePath(article), detail(article), titles, descriptions, cover(article));
  }
}

module.exports = { buildInsights };
