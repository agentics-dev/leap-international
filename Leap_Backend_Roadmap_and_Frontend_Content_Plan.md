# Leap International — Backend Remediation Roadmap & Frontend Content Plan

> Derived from: **AI Visibility Audit (50 pages, 2026-08-14)** — AI Recommendation Score **28/100** ("invisible"),
> SEO 73/100, Technical Health 73/100, GEO page-signal score 13/70, Comparison Pages 0/100, Overall 69.3/100.
> Companion to: `Leap_Keyword_Competitor_Execution_Plan.md` (keyword/competitor detail — not repeated here).
>
> **Scope rule for this document:** the phased roadmap contains **backend/infrastructure changes only** (no page
> copy or design edits). All visible-content work is listed separately as the *frontend content plan* (suggestions).

---

## 0. Read this first — audit data-quality caveats

Before executing, note four artifacts in the audit that change what is actually broken:

| # | Caveat | Evidence | Consequence |
|---|--------|----------|-------------|
| 1 | **The audit scanned a localhost deployment, not production.** | Page 5 literally reads "localhost 在傳統搜尋（SEO）和 AI 搜尋（GEO）兩個戰場均有可行基礎". | The single "critical" finding (no HTTPS) and "0 internal links" are almost certainly artifacts of the scan target. Production (`leapcorpser.com` on Netlify) serves HTTPS with HSTS already. **Re-baseline against production before prioritizing.** |
| 2 | Category placeholders leaked into the report. | Repeated "Hong Kong Business", "Hong Kong邊間Business最好？", competitor "SinoPac Capital International (HK) Limited". | Validate the competitor list before writing comparison pages — Tricor/Vistra/Sino Corporate/AsiaBC are plausible; "SinoPac Capital" looks like a template artifact. |
| 3 | Score contradictions. | GEO shown as 90/100 (p.4), 13/70 (p.11), and 19% (p.17). | Treat scores directionally; the *checklists* (what passed/failed) are the reliable part. |
| 4 | Keyword volumes are AI estimates. | Report itself: "搜尋量及 KD 數據需使用付費關鍵字研究模組". | Verify volumes/KD in Google Keyword Planner or Ahrefs before committing content budget. |

**What is genuinely broken and confirmed by the codebase itself** (independent of scan target):
- No `llms.txt` at domain root.
- `robots.txt` has no explicit AI-crawler rules (relies on blanket `Allow: /`).
- `sitemap.xml` is hand-maintained — it **omits `news.html` / `news-detail.html`** (the freshest, most GEO-relevant pages) and its `lastmod` dates drift from reality.
- No `dateModified` / `datePublished` schema anywhere (0 occurrences in markup) and no visible "last updated" dates.
- Homepage `<title>` is 85 chars (audit limit: 30–60) and meta description 185 chars (limit: 120–160).
- Organization schema has only **1 `sameAs` profile**; no author entities anywhere (no bylines possible).
- No IndexNow key file at root; no publish-time indexing push.
- No pricing/comparison landing targets for BOFU queries (pricing page exists but is excluded from nothing / included in sitemap — however no comparison pages exist at all).
- No BreadcrumbList on inner pages (homepage only).
- No RSS/Atom feed for the news section despite a working Supabase-backed news pipeline.

---

# PART A — BACKEND-ONLY ROADMAP (phased)

> **Execution status (2026-08-14, update 3): ALL FIVE PHASES are now code-complete.**
> Update 2 recap: Phases 0–1 (host fix, llms.txt, robots, sitemap, IndexNow), Phase 2 (Article/FAQ schema,
> RSS), Phase 3 (authors/comparisons/case-studies data model + APIs + admin UI).
> **Update 3 adds:** Phase 4 — `crawl_events` migration, `/api/crawl-log` ingest, edge loggers for AI-crawler
> hits (Cloudflare Pages `functions/_middleware.js` + Netlify `netlify/edge-functions/ai-crawl-logger.ts`),
> build-time AI-referral beacon on all public pages, and an **Admin → AI Crawlers** dashboard; Phase 4.1/4.3/4.4
> and Phase 5 (GA4 AI channel group, monthly rescan, KPIs, GBP/Wikidata/HARO/directories) are documented as a
> step-by-step ops checklist in **`leap-international-main/docs/ops-runbook.md`**.
>
> Earlier status: Phases 0, 1, 2 and the Phase 3 code are **IMPLEMENTED**
> in `leap-international-main/`:
> - Phase 0/1: `seo/seo.config.json`, `scripts/build.js`, `scripts/build-seo.js`, `scripts/indexnow-push.js`,
>   `netlify/functions/indexnow-push.js`, rewritten `robots.txt`. Canonical-host fix: `www.leapcorpser.com`
>   has **no DNS record** while all canonical URLs pointed to it — the build normalizes everything to apex
>   `https://leapcorpser.com` (flip `canonicalHost` in `seo/seo.config.json` if you add the www record).
> - Phase 2: Article JSON-LD on news articles (`pages/news-detail.html` + extended `/api/news-detail`),
>   FAQPage Q&A-count validation in the build lint (currently warns: `faqs.html` has only 3 Q&A pairs),
>   RSS feed at `/feed.xml` (build-time from Supabase), RSS autodiscovery link.
> - Phase 3: `supabase/migrations/20260814_phase3_cms_extensions.sql` (authors, news/FAQ extensions,
>   comparisons, case_studies + RLS), new APIs `api/authors.js` `api/comparisons.js` `api/case-studies.js`,
>   extended news/FAQ APIs (auto-fallback until migration is applied), Netlify wrappers so `/api/*` works
>   on Netlify AND Vercel, admin panel sections: Authors / Comparison Pages / Case Studies + News editor
>   byline & evidence fields.
>
> **Manual steps remaining:** apply the SQL migration in Supabase; GSC/Bing verification; Netlify deploy
> webhook for IndexNow; create LinkedIn/Crunchbase profiles and add them to `sameAs` in `seo/seo.config.json`.

Stack context: static HTML site + Netlify (`netlify.toml`, `netlify/functions/`) + Vercel-compatible `api/` +
Supabase (news/FAQ CMS + admin panel in `admin_src/`). All tasks below touch **config, build tooling,
serverless functions, CMS data models, and ops accounts only — zero changes to visible page content or design.**

## Phase 0 — Re-baseline & domain hygiene (Week 1)

**Goal:** replace localhost-based findings with a true production baseline; lock the canonical host.

| Task | Where / how |
|---|---|
| 0.1 Re-run the audit (or equivalent crawler checks) against `https://www.leapcorpser.com` | External scan; record new baseline scores to replace the localhost artifacts |
| 0.2 Enforce canonical host: 301 `http://` → `https://` and apex → `www` (or vice versa, pick one) | `netlify.toml` `[[redirects]]` with `force = true` |
| 0.3 Verify HSTS, `X-Content-Type-Options`, CSP already in `netlify.toml` are active on production responses | `curl -I` against production |
| 0.4 Verify Google Search Console + Bing Webmaster Tools ownership (meta tag or file verification) | GSC / BWT accounts; serve verification file from site root via `dist/` |
| 0.5 Submit `sitemap.xml` to GSC and BWT | Webmaster consoles |

**Exit criteria:** production baseline recorded; single canonical scheme+host; both webmaster tools verified and sitemap accepted.

## Phase 1 — Machine-readable site layer (Week 1–2)

**Goal:** give search and AI crawlers explicit, complete, self-updating maps of the business.
This is the highest-leverage backend phase: every item is a file or function, no page edits.

| Task | Details |
|---|---|
| 1.1 **Create `/llms.txt`** (and optionally `/llms-full.txt`) | Static file at domain root per llmstxt.org: company definition ("Leap International Corporate Service Limited is a Hong Kong corporate services firm that…"), service list, key pages with one-line descriptions, contact/NAP. Generate it at build time from a single source-of-truth data file so it can't drift. |
| 1.2 **Rewrite `robots.txt` with explicit AI-crawler rules** | Keep current disallows (`/netlify/`, payment/confirmation, `/pages/cs-*`); add explicit `Allow: /` blocks for `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Bytespider` (Doubao — the audit explicitly warns blocking it = invisible to Doubao), `Google-Extended`, `meta-externalagent`. |
| 1.3 **Auto-generate `sitemap.xml` at build time** | Node build script: scan `pages/`, exclude transactional pages (`payment*`, `confirmation`, `cs-*`, checkout flows), **include `news.html` + `news-detail.html` + every published news slug from Supabase**, set `lastmod` from file mtime / article `publish_time`. Kills manual drift permanently. |
| 1.4 **IndexNow setup** | Generate key at bing.com/indexnow; serve `<key>.txt` from site root (add to `dist/` copy list in `package.json` build script). |
| 1.5 **IndexNow auto-push function** | New serverless function `indexnow-push` that POSTs changed URLs to `api.indexnow.org`; trigger it from Netlify's `deploy-succeeded` webhook (diff of changed files → URL list). Priority URLs per audit: pricing, new articles, comparison pages. |

**Exit criteria:** `llms.txt` live; robots.txt lists AI crawlers; sitemap regenerates on every build and contains news URLs; IndexNow key verifiable at root and a test push returns 200.

## Phase 2 — Structured-data & metadata pipeline (Week 2–4)

**Goal:** close the schema/freshness gaps (audit: "所有頁面添加可見的『最後更新』日期 ＋ schema `dateModified`")
**via build-time injection — no visible page changes.**

| Task | Details |
|---|---|
| 2.1 **Build-time JSON-LD injector** | Node script in the build pipeline that injects into every page: `Organization` (with expanded `sameAs`: LinkedIn, Crunchbase, etc. as profiles are created), `WebSite`, `BreadcrumbList` on all inner pages (audit: homepage only today), `dateModified` from file mtime or a `content/lastmod.json` manifest. |
| 2.2 **Article schema for news** | Extend `api/news.js` / `api/news-detail.js` responses (and/or the news-detail page build) to emit `Article` JSON-LD with `headline`, `datePublished`, `dateModified`, `author` (Person, once Phase 3 authors exist). |
| 2.3 **FAQPage schema validation** | FAQ schema exists — audit confirms — but FAQ *content* has 0 question-style headings. Add a build-time check that warns when `FAQPage` JSON-LD has fewer than N Q&A pairs, so schema never ships empty. (Filling in the questions is frontend work — Part B.) |
| 2.4 **Title/meta length lint in CI** | Build script fails/warns when `<title>` ∉ 30–60 chars or meta description ∉ 120–160 chars sitewide (current homepage: 85 / 185). Rewriting the copy is frontend; *enforcing the standard* is backend. |
| 2.5 **RSS/Atom feed for news** | Serverless function `/feed.xml` generated from Supabase `news_activities` (published only, ordered by `publish_time desc`). Cheap, machine-readable freshness/distribution signal. |

**Exit criteria:** every deployed page carries Organization + BreadcrumbList + `dateModified`; news articles carry Article schema; feed validates; CI lints title/meta lengths.

## Phase 3 — CMS & data model to support the content plan (Week 3–6)

**Goal:** make the Supabase backend capable of storing and serving everything the frontend content plan needs,
so frontend work later is pure presentation.

| Task | Details |
|---|---|
| 3.1 **`authors` table** | name, title, one-line credential, photo, bio, LinkedIn URL — powers bylines and author pages (audit Expertise = ✗ "完全沒有執行"). |
| 3.2 **Extend `news_activities`** | add `author_id` FK, `updated_at` display field, `sources` (JSON), `key_stats` (JSON) — supports the evidence-layer requirement (43% of GEO weight: quotes 16% + statistics 14% + citability 13%). |
| 3.3 **`faqs` hardening** | enforce question-format titles ("什麼是…？", "How much…?"), add `category`, link FAQ → related service page for internal-link matrix. |
| 3.4 **`comparisons` table + `/api/comparisons`** | competitor name, logo, comparison rows (JSON), FAQ pairs, last-reviewed date — the data backbone for the 0/100 comparison-page gap. |
| 3.5 **`case_studies` table + API** | client (anonymizable), industry, numbers (JSON: revenue, days saved, etc.), quote — powers E-E-A-T "Success Stories". |
| 3.6 **Admin panel fields** | surface the above in `admin_src` (author picker, updated-at, comparison editor) so non-devs can maintain it. |

**Exit criteria:** APIs return authors/comparisons/case-studies; admin can CRUD all of them; nothing visible on the site has changed yet.

## Phase 4 — Measurement & monitoring loop (Week 4–6, then monthly ops)

**Goal:** know whether GEO is working (audit: "修復 → 發布 → 每月重新掃描 → 對比分數").

| Task | Details |
|---|---|
| 4.1 **GA4 AI-referral channel group** | Custom channel group matching `openai\|chatgpt\|perplexity\|copilot\|gemini\|claude` (GA4 admin — flagged "未能核實" in audit; verify it exists). |
| 4.2 **AI-crawler access logging** | Log/alert on GPTBot, ClaudeBot, PerplexityBot, Bytespider hits (Netlify log drain or lightweight middleware function) — confirms AI crawlers actually read the site post-fix. |
| 4.3 **Monthly re-scan cadence** | Re-run the visibility audit monthly; track the 6-engine mention score vs. the 28/100 baseline. |
| 4.4 **KPI targets (from audit p.44)** | 5 keywords top-20 in 3 months; 10 top-10 in 6 months; 20 top-10 in 12 months; organic +10–20%/month (new site); conversion 1–3%. Track via GSC + GA4 monthly report (audit supplies a template). |

## Phase 5 — Off-site entity & authority ops (Months 2–6, parallel track)

**Goal:** fix "0 of 6 verifiable platforms" — the root cause of AI invisibility. Not code, but backend/ops
responsibilities that feed every AI engine's cross-verification.

1. Complete remaining local directories (3/3 held) → category review sites & industry directories.
2. Claim Google Business Profile; set primary/secondary categories.
3. Create **Wikidata** entry once coverage exists; Wikipedia later (notability rules).
4. LinkedIn company page + link it from schema `sameAs` (Phase 2.1 consumes this).
5. Weekly HARO/Qwoted answers; one original data story (survey/statistics page) pitched to industry media per quarter.
6. Chinese-platform mentions for Doubao (Toutiao/Zhihu) once Chinese content ships.

## Backend roadmap at a glance

```
Week 1    Phase 0  Re-baseline on production, canonical host, GSC/BWT verified
Week 1–2  Phase 1  llms.txt · robots.txt AI rules · auto-sitemap (+news) · IndexNow key + push
Week 2–4  Phase 2  JSON-LD injection (Org/sameAs/Breadcrumb/dateModified) · Article/FAQ schema · CI lints · RSS
Week 3–6  Phase 3  Supabase: authors, comparisons, case studies, FAQ hardening, admin UI
Week 4–6  Phase 4  GA4 AI channel · AI-crawler logs · monthly rescan · KPI dashboard
Month 2+  Phase 5  Directories · GBP · Wikidata · HARO · sameAs targets  (parallel ops track)
```

Audit alignment: Phases 0–2 clear every "P0/立即修復" technical item (HTTPS verification, llms.txt,
title/meta enforcement, dates/schema, IndexNow, Bing indexing). Phases 3–5 build the evidence and entity
layers that drive the 28/100 → citable-source transition. Expected-results checkpoints from the audit:
**Month 1** foundation complete (crawlers fully read/index site); **Month 3** first AI citations of
comparison tables/FAQs; **Month 6** compounding (8–20 articles/month, recognized category source).

---

# PART B — FRONTEND CONTENT PLAN (suggestions only — no implementation here)

Everything below is visible-content work for later execution. Keyword detail lives in
`Leap_Keyword_Competitor_Execution_Plan.md`; this plan maps it to pages and templates.

## B1. Site architecture — pillar & cluster (from audit §4.1)

Build three pillar hubs; every article links up to its pillar and sideways to 2–3 cluster siblings
(descriptive anchor text — never "按此了解詳情"). Homepage links to all pillars (fixes "0 internal links").

```
Homepage (entity definition + Key Stats + FAQ)
├── Pillar 1: 外國人在香港成立公司的完整指南 (target: 外國人在香港設立公司)
│     ├── 外國人香港公司註冊流程      ├── 非居民香港開公司
│     ├── 外籍人士香港創業            └── 香港公司設立要求
├── Pillar 2: 外國人申請香港商業簽證與居留權
│     ├── 香港投資簽證申請            ├── 香港創業移民條件
│     ├── 外國人香港工作簽證          └── 香港居留權申請
└── Pillar 3: 外國人在香港營運公司的法律與合規
      ├── 香港公司秘書服務            ├── 香港公司會計報稅
      ├── 香港銀行開戶外國人          └── 香港公司年度申報
```

Also required landing pages: dedicated BOFU page per high-intent keyword
(e.g. **"Foreigners start company Hong Kong"** — currently not in Google's top 10),
`/compare/[competitor]` pages, and an improved pricing page.

## B2. Priority page work (audit priority order)

1. **Homepage rework** — first paragraph defines the entity ("Leap International Corporate Service Limited
   is a Hong Kong corporate services firm that…"), add a "By the Numbers" Key Stats table (founding year,
   clients served, partners), a 5+ question FAQ block with question-style H3s, TL;DR, visible last-updated date.
2. **Comparison pages (0/100 → the single biggest content gap)** — one page per validated competitor,
   template per audit SOP: quick comparison table (8–15 rows) directly under H1 → "Choose X if… / Choose Y if…"
   → 5–8 FAQs with FAQPage JSON-LD → honest, fact-based tone (admit competitor strengths), "last updated" date.
3. **FAQ page expansion** — 20+ real client questions in question format, covering what/how/why/vs;
   mine the long-tail list (e.g. 外國人在香港開公司需要多少資金？ / 非香港居民可以在香港擔任董事嗎？).
4. **Pricing transparency** — visible packages/fees (audit: pricing opacity blocks decision-stage users).
5. **E-E-A-T pages** — About/Leadership with real names, photos, credentials; author byline + author page
   for every article; case studies with named clients and real numbers (2–3 per quarter).
6. **Titles & metas** — rewrite sitewide: title 30–60 chars, primary keyword front-loaded, include
   year/formula word where natural ("2026", "Guide"); meta 120–160 chars: keyword → one concrete benefit → CTA.

## B3. Writing standards (audit's quality bar — apply to every piece)

- **Answer-first:** one-sentence direct answer in the opening paragraph; time-anchored first-person scenes
  for flagship pieces (E-E-A-T "Experience").
- **Evidence layer (43% of GEO weight):** every core claim paired with a verifiable expert/institutional quote
  or full-context statistic (value + sample + period + source); ≥1 primary source per article (cr.gov.hk,
  InvestHK, IRD); never invent numbers.
- **Structure:** clear H1→H2→H3, short 2–4-sentence paragraphs, bullet lists, at least one table;
  FAQ block per page; standalone citable sentences.
- **Freshness:** visible "last updated" date on every page; reference the current year; monthly refresh of
  time-window content.
- **Don't:** empty superlatives ("best/leading"), keyword stuffing, walls of text, promotional tone —
  neutrality wins citations.

## B4. Six-month editorial calendar (condensed from audit pp.40–41)

Cadence: **2 articles/week (≈8/month)** for a new site; type mix — blog 40% · guides/whitepapers 20% ·
case studies 15% · infographics 15% · FAQ 10%. 7-day production loop per article
(2d research → 3d writing → 1d SEO/GEO optimization → 1d publish + promote).

| Month | Theme | Anchor pieces |
|---|---|---|
| 1 (Sep 2026) | Foundations & core services | 香港公司註冊完整指南：從零開始 · 了解香港稅務制度 · 為什麼選擇 Leap International 作為您的公司秘書？ |
| 2 (Oct 2026) | Expansion & compliance | 香港會計與審計要求 · 離岸公司設立協同 · 商標註冊流程 · 新公司香港銀行開戶 |
| 3 (Nov 2026) | Optimization & efficiency | 電商稅務考量 · 工作簽證與人才引進 · 公司秘書提升行政效率 |
| 4 (Dec 2026) | Deep insights & trends | 家族辦公室設立 · 最新稅務優惠解讀 · 虛擬辦公室法律考量 |
| 5 (Jan 2027) | Advanced strategy & cases | 跨國企業進駐香港案例 · 上市前合規 · 股權轉讓與重組 · 金融科技註冊監管 |
| 6 (Feb 2027) | Refresh & consolidate | 公司註冊 FAQ 更新版 · 稅務合規清單 · 如何選擇可靠的香港公司服務提供商 |

Plus the **time-window bonus track** (publish first, refresh monthly): 2026 香港公司法改革 外國人 ·
2026 外國人香港營商政策 · 2026 香港稅務優惠 外國人.
And **comparison pages in weeks 2–4** (they convert 5–10× better than TOFU content and are the format AI
engines cite most): validate the competitor list first (see caveat #2), then ship vs-Tricor, vs-Vistra, etc.

## B5. Bilingual & distribution notes

- Publish in both English and Traditional Chinese (Doubao/Chinese queries need Chinese content; the audit's
  keyword matrix is Chinese-first, the execution plan adds English variants).
- Promotion: LinkedIn primary (Tue–Thu 9–11am; summary+link on day 0, insight post on day 3), biweekly email
  digest; IndexNow push is already automated by backend Phase 1.5.
- Update triggers: ranking drop >5, traffic drop >20%, 12 months stale, regulatory change, better competitor
  content → refresh immediately.

---

## Success metrics recap

| Horizon | Target (from audit) |
|---|---|
| Month 1 | All technical blockers cleared; crawlers fully read/index site; baseline re-scan |
| Month 3 | 5 keywords in top 20; first AI-engine citations (comparison tables / FAQ blocks) |
| Month 6 | 10 keywords in top 10; 8–20 articles/month; AI engines treat Leap as a citable category source |
| Month 12 | 20 keywords in top 10; conversion rate 1–3% |
| Continuous | AI visibility score: 28/100 → measured monthly; AI-referral traffic visible in GA4 |
