# SUGGESTED CONTENT — Leap International (English)

Frontend content package generated from the content plan (`Leap_Backend_Roadmap_and_Frontend_Content_Plan.md`, Part B)
and the AI Visibility Audit. **Nothing here is live yet** — review, verify the `[VERIFY]` placeholders, then publish.

## What's inside

| Folder | Contents | Priority |
|---|---|---|
| `01-homepage/` | Homepage rework copy deck — entity definition, Key Stats, FAQ block | P0 |
| `02-bofu-landing-pages/` | "Foreigners Start a Company in Hong Kong" dedicated landing page | P0 |
| `03-comparison-pages/` | Leap vs other corporate service providers — generic positioning, **no competitor names** (per client direction; audit's highest-ROI format, was 0/100) | P0 |
| `04-pillar-content/` | Pillar 1: Complete Guide to Starting a HK Company as a Foreigner (2026) | P1 |
| `05-faq/` | FAQ page expansion — 22 question-format Q&As (audit: aim 20+) | P0 |
| `06-editorial-calendar/` | 6-month calendar: English titles, keywords, briefs for every article | ongoing |

## How to publish

- **News/articles** → Admin panel → News & Activities (assign an author, fill Sources + Key Stats JSON).
- **Comparison data** → Admin panel → Comparison Pages (the rows/FAQs in `03-comparison-pages/` drop straight
  into the JSON fields).
- **FAQ entries** → Admin panel → FAQ Management.
- **Homepage/service-page copy** → hand to whoever edits the HTML pages.

After publishing anything: rebuild (`npm run build`) — sitemap, llms.txt, feed.xml and IndexNow update automatically.

## Standards every piece already follows (keep them when editing)

1. **Answer-first** — the opening paragraph directly answers the page's question in 1–2 sentences.
2. **Entity definition** — "Leap International Corporate Service Limited is a Hong Kong corporate services firm…"
3. **Key Stats table** near the top of long pieces (this is what AI engines lift as citations).
4. **Question-format H2/H3 headings** for FAQs; 5–10 per pillar, 5–8 per comparison page.
5. **Visible "Last updated" date** on every piece; refresh time-sensitive pieces monthly.
6. **Title 30–60 chars / meta description 120–160 chars** — given at the top of each file.
7. **Evidence layer** — statistics with source (Companies Registry, IRD, InvestHK, Immigration Department);
   never invent numbers. Company-specific figures are marked `[VERIFY]`.
8. **Neutral, factual tone** — no "best/leading/top" superlatives, no keyword stuffing; comparison pages
   admit competitor strengths on purpose (objectivity is what gets cited).
9. **Internal links** with descriptive anchors (never "click here") — link up to service pages and sideways
   to related guides.
10. **Author byline** on every article — pick an author in the admin panel (create one under Authors first).

## Placeholder legend

- `[VERIFY]` — confirm this figure/fact before publishing (company stats, fees that change yearly, competitor data).
- `[AUTHOR]` — insert byline (name + title + one-line credential) from Admin → Authors.
- `[LINK: /pages/...]` — internal link to add when the copy goes into the HTML/CMS.
