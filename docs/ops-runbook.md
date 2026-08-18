# Ops Runbook — GEO/SEO Measurement Loop & Off-Site Entity Building

Covers the account/ops tasks of Phase 4 and Phase 5 that cannot be automated in code.
Everything code-side is already implemented (see roadmap doc for the file map).

---

## Phase 4.1 — GA4: AI-referral channel group (15 min, one-time)

GA4 → Admin → Data display → **Channel groups** → **Create new channel group** ("AI Search"):

1. Add a channel named **AI Search** with condition: *source* matches regex
   ```
   chatgpt|openai|perplexity|copilot|claude|gemini|bard|doubao|you\.com|phind
   ```
2. **Reorder** so "AI Search" sits above "Referral" (first match wins).
3. Save. Review monthly: Reports → Acquisition → Traffic acquisition → choose the new channel group.

> Companion already live: the build injects a beacon on every public page that logs
> AI-referred visits to `/api/crawl-log` — visible in **Admin → AI Crawlers** even
> without this GA4 setup. The GA4 group gives you the same data inside GA4.

Also verify: GA4 → Admin → Data streams → the leapcorpser.com stream is collecting
(audit could not verify this externally).

## Phase 4.2 — AI-crawler logging (already implemented)

| Piece | File | Notes |
|---|---|---|
| Events table | `supabase/migrations/20260814_phase4_crawl_events.sql` | **Apply in Supabase SQL editor** |
| Ingest endpoint | `api/crawl-log.js` (+ Netlify wrapper) | Validates & inserts events |
| Edge logger (Cloudflare Pages) | `functions/_middleware.js` | Auto-runs on Pages deploys |
| Edge logger (Netlify) | `netlify/edge-functions/ai-crawl-logger.ts` | Registered in `netlify.toml` |
| Dashboard | Admin → **AI Crawlers** | 30-day bot & referral counts |

**Verify after deploy:** `curl -A "GPTBot/1.0" https://leapcorpser.com/` → an event
should appear in Admin → AI Crawlers within a minute.

## Phase 4.3 — Monthly re-scan cadence (recurring, 30 min/month)

- [ ] Re-run the AI visibility audit against `https://leapcorpser.com` (production, **not** localhost)
- [ ] Record the 6-engine mention scores vs. the 28/100 baseline in a tracking sheet
- [ ] Check Admin → AI Crawlers: which bots visited? Any referrals?
- [ ] GSC: indexed pages, impressions trend; note any coverage errors
- [ ] Review content freshness triggers (rank drop >5, traffic drop >20%, >12 months stale)

## Phase 4.4 — KPI targets (from audit p.44)

| Metric | 3 months | 6 months | 12 months |
|---|---|---|---|
| Keywords in top 20 / top 10 | 5 in top 20 | 10 in top 10 | 20 in top 10 |
| Organic traffic (new site) | +10–20%/month | compounding | — |
| Conversion rate (B2B content) | — | 1–3% | 1–3% |
| AI visibility score | first citations | — | from 28/100 upward |

Monthly report template: audit p.44 §2.9 (executive summary → content published →
traffic by pillar → ranking table → top-3 content → next-month plan).

---

## Phase 5 — Off-site entity & authority (parallel track, months 2–6)

Root cause of 28/100: **0 of 6 verifiable platforms**. AI engines cross-verify your
entity off-site; this checklist builds that footprint. Ordered by leverage:

### 5.1 Profiles & directories (week 1–2 of the track)
- [ ] **LinkedIn company page** — fill completely (NAP must match the site exactly:
      "Leap International Corporate Service Limited", Room 908 Energy Plaza, +852 65550943)
- [ ] **Crunchbase** entry (free)
- [ ] Remaining HK local directories (3/3 held at audit time — extend to category
      review sites and industry directories)
- [ ] After each profile exists: add its URL to `sameAs` in `seo/seo.config.json`
      and rebuild — schema updates sitewide automatically

### 5.2 Google Business Profile (week 2)
- [ ] Claim/verify GBP for the TST East office
- [ ] Primary category: *Corporate office* / *Business to business service*;
      secondary: *Accounting firm*, *Legal services* (audit's "Geo Category Generator" suggestion)
- [ ] Add services, opening hours (Mo–Fr 09:00–18:00), logo, link to https://leapcorpser.com

### 5.3 Wikidata → Wikipedia (month 2+, after coverage exists)
- [ ] Create the **Wikidata** item (instance of: business; country: Hong Kong; official
      website; address) — allowed once you have a few independent references
- [ ] Wikipedia only after notability criteria are met (independent media coverage) —
      do not force it (conflict-of-interest rules)

### 5.4 Editorial backlinks (ongoing, weekly cadence)
- [ ] **HARO / Qwoted**: answer 2–3 journalist requests per week (HK business,
      incorporation, tax topics)
- [ ] One **original data story** per quarter (e.g. "Hong Kong company formation
      statistics for foreign founders 2026") pitched to industry media and vertical KOLs
- [ ] Guest posts on industry association sites; link exchanges with partner
      institutions/suppliers (audit: consumer-adapted channels = industry media,
      schools/institutions, vertical KOLs)
- [ ] Never buy links; if bought in the past, review in GSC and disavow toxic ones

### 5.5 Chinese-platform mentions (for Doubao, month 3+)
- [ ] Toutiao / Zhihu / WeChat articles mirroring the Chinese pillar content
- [ ] Keep brand name identical across platforms (entity consistency)

### 5.6 Entity-consistency rule (applies to everything above)
Every off-site mention must use the **exact same** legal name, address, phone and
apex URL `https://leapcorpser.com` — inconsistent NAP is how entity verification fails.
