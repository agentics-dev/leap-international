#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const DIST = process.argv[2] || path.join(ROOT, 'dist');
const SOURCES = [
  ['incorporation-locals', 'Incorporation for Hong Kong Residents', '香港人公司註冊', '香港人公司注册'],
  ['incorporation-foreigners', 'Incorporation for Non-Hong Kong Residents', '非香港人公司註冊', '非香港人公司注册'],
  ['accounting', 'Accounting', '會計服務', '会计服务'],
  ['bookkeeping', 'Bookkeeping', '記帳服務', '记账服务'],
  ['corporate-secretary', 'Corporate Secretary', '公司秘書服務', '公司秘书服务'],
  ['annual-return-filing', 'Annual Return Filing', '年度申報', '年度申报'],
  ['registered-office-address', 'Registered Office Address', '註冊辦公地址', '注册办公地址'],
  ['sales-invoice', 'Company Concierge Services', '公司管家服務', '公司管家服务'],
];

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function text(element, selector) {
  return element.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || '';
}

function languageSpans(values) {
  return `<span class="lang-en">${escapeHtml(values[0])}</span>` +
    `<span class="lang-zh">${escapeHtml(values[1])}</span>` +
    `<span class="lang-zh-Hans">${escapeHtml(values[2])}</span>`;
}

function readSource([slug, ...labels]) {
  const file = path.join(ROOT, 'pages', `${slug}.html`);
  const document = new JSDOM(fs.readFileSync(file, 'utf8')).window.document;
  const questions = [...document.querySelectorAll('main .faq-btn')].map(button => {
    const answer = button.nextElementSibling;
    if (!answer?.classList.contains('faq-content')) {
      throw new Error(`${slug}: FAQ answer is missing`);
    }
    const question = ['.lang-en', '.lang-zh', '.lang-zh-Hans'].map(selector => text(button, selector));
    const response = ['.lang-en', '.lang-zh', '.lang-zh-Hans'].map(selector => text(answer, selector));
    if ([...question, ...response].some(value => !value)) {
      throw new Error(`${slug}: FAQ translation is missing`);
    }
    return { question, answer: response };
  });
  if (!questions.length) throw new Error(`${slug}: no FAQs found`);
  return { slug, labels, questions };
}

function renderSection({ slug, labels, questions }) {
  const items = questions.map(({ question, answer }) => `
      <details class="faq-item bg-white border border-gray-200 rounded-lg shadow-sm">
        <summary class="faq-summary flex items-center justify-between gap-4 px-6 py-5 cursor-pointer font-semibold text-gray-900 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          <span>${languageSpans(question)}</span>
          <span class="faq-arrow material-symbols-outlined text-blue-600 shrink-0" aria-hidden="true">expand_more</span>
        </summary>
        <div class="px-6 pb-5 text-gray-600 leading-relaxed">${languageSpans(answer)}</div>
      </details>`).join('');
  return `
    <section class="faq-group">
      <h2 class="text-xl font-bold text-gray-900 mb-4"><a class="hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" href="/pages/${slug}.html">${languageSpans(labels)}</a></h2>
      <div class="space-y-3">${items}
      </div>
    </section>`;
}

function main() {
  const groups = SOURCES.map(readSource);
  const htmlPath = path.join(DIST, 'pages', 'faqs.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://leapcorpser.com/pages/faqs.html#faqpage',
    mainEntity: groups.flatMap(group => group.questions.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question[0],
      acceptedAnswer: { '@type': 'Answer', text: answer[0] },
    }))),
  };
  const replacements = [
    ['<!-- FAQ_ITEMS -->', groups.map(renderSection).join('')],
    ['<!-- FAQ_SCHEMA -->', `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`],
  ];
  for (const [marker, value] of replacements) {
    if (!html.includes(marker)) throw new Error(`Missing FAQ template marker: ${marker}`);
    html = html.replace(marker, value);
  }
  fs.writeFileSync(htmlPath, html);
  console.log(`Generated ${schema.mainEntity.length} FAQs from ${groups.length} service pages`);
}

main();
