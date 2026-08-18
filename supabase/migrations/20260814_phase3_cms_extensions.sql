-- ============================================================================
-- Phase 3 CMS extensions — Leap International
-- Authors (E-E-A-T bylines), news/FAQ extensions, comparison pages, case studies.
-- Apply with:  psql <db> -f this_file.sql   (or paste into Supabase SQL editor)
-- Safe to re-run: all statements are idempotent (IF NOT EXISTS / OR REPLACE).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 3.1 authors — powers article bylines, author pages, Article schema `author`
-- ---------------------------------------------------------------------------
create table if not exists public.authors (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,                    -- e.g. "jane-chan" -> /pages/author page later
  name          text not null,
  name_zh       text,
  title         text,                           -- job title (EN), e.g. "Founder & Principal Consultant"
  title_zh      text,
  credential    text,                           -- one-line credential, e.g. "HKICPA, 20+ years in HK corporate services"
  credential_zh text,
  bio           text,
  bio_zh        text,
  photo_url     text,
  linkedin_url  text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.authors enable row level security;

drop policy if exists "authors public read" on public.authors;
create policy "authors public read"
  on public.authors for select
  using (is_active = true);

drop policy if exists "authors authenticated manage" on public.authors;
create policy "authors authenticated manage"
  on public.authors for all to authenticated
  using (true) with check (true);

grant select on public.authors to anon;
grant all on public.authors to authenticated;

-- ---------------------------------------------------------------------------
-- 3.2 news_activities extensions — byline + evidence layer (43% of GEO weight)
-- ---------------------------------------------------------------------------
alter table public.news_activities
  add column if not exists author_id uuid references public.authors(id) on delete set null,
  add column if not exists updated_at timestamptz,
  add column if not exists sources jsonb not null default '[]'::jsonb,    -- [{label, url}] primary sources
  add column if not exists key_stats jsonb not null default '[]'::jsonb;  -- [{label, value}] citable stats

create index if not exists news_activities_author_id_idx on public.news_activities (author_id);

-- ---------------------------------------------------------------------------
-- 3.3 faqs hardening — categorisation + internal-link targets
-- ---------------------------------------------------------------------------
alter table public.faqs
  add column if not exists category text not null default 'general',
  add column if not exists related_page text,               -- e.g. "/pages/pricing.html"
  add column if not exists updated_at timestamptz not null default now();

create index if not exists faqs_category_idx on public.faqs (category);

-- ---------------------------------------------------------------------------
-- 3.4 comparisons — data backbone for "X vs Y" pages (audit: 0/100 gap)
-- ---------------------------------------------------------------------------
create table if not exists public.comparisons (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,              -- e.g. "leap-vs-tricor"
  competitor_name     text not null,
  competitor_url      text,
  title_en            text not null,                     -- "Leap International vs Tricor: which fits you?"
  title_zh            text,
  summary_en          text,                              -- answer-first opening paragraph
  summary_zh          text,
  comparison_rows     jsonb not null default '[]'::jsonb,  -- [{dimension, leap, competitor}] 8-15 rows
  choose_leap_if      jsonb not null default '[]'::jsonb,  -- ["...", "..."]
  choose_competitor_if jsonb not null default '[]'::jsonb, -- honest: admit competitor strengths
  faq_items           jsonb not null default '[]'::jsonb,  -- [{question_en, answer_en, question_zh, answer_zh}] 5-8
  author_id           uuid references public.authors(id) on delete set null,
  is_published        boolean not null default false,
  last_reviewed_at    date,                              -- drives visible "last updated" + freshness
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.comparisons enable row level security;

drop policy if exists "comparisons public read" on public.comparisons;
create policy "comparisons public read"
  on public.comparisons for select
  using (is_published = true);

drop policy if exists "comparisons authenticated manage" on public.comparisons;
create policy "comparisons authenticated manage"
  on public.comparisons for all to authenticated
  using (true) with check (true);

grant select on public.comparisons to anon;
grant all on public.comparisons to authenticated;

-- ---------------------------------------------------------------------------
-- 3.5 case_studies — E-E-A-T proof ("Success Stories" with real numbers)
-- ---------------------------------------------------------------------------
create table if not exists public.case_studies (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique,
  client_name     text,                          -- optional; may stay anonymous
  client_label_en text not null,                 -- e.g. "Singaporean e-commerce founder"
  client_label_zh text,
  industry        text,
  title_en        text not null,
  title_zh        text,
  summary_en      text,
  summary_zh      text,
  body_en         text,
  body_zh         text,
  metrics         jsonb not null default '[]'::jsonb,   -- [{label, value}] e.g. {"Setup time","3 days"}
  quote           text,
  quote_author    text,
  services        text[] not null default '{}',          -- e.g. {incorporation, accounting}
  author_id       uuid references public.authors(id) on delete set null,
  is_published    boolean not null default false,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.case_studies enable row level security;

drop policy if exists "case_studies public read" on public.case_studies;
create policy "case_studies public read"
  on public.case_studies for select
  using (is_published = true);

drop policy if exists "case_studies authenticated manage" on public.case_studies;
create policy "case_studies authenticated manage"
  on public.case_studies for all to authenticated
  using (true) with check (true);

grant select on public.case_studies to anon;
grant all on public.case_studies to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance trigger (shared)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_authors_updated_at on public.authors;
create trigger set_authors_updated_at before update on public.authors
  for each row execute function public.set_updated_at();

drop trigger if exists set_news_updated_at on public.news_activities;
create trigger set_news_updated_at before update on public.news_activities
  for each row execute function public.set_updated_at();

drop trigger if exists set_faqs_updated_at on public.faqs;
create trigger set_faqs_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();

drop trigger if exists set_comparisons_updated_at on public.comparisons;
create trigger set_comparisons_updated_at before update on public.comparisons
  for each row execute function public.set_updated_at();

drop trigger if exists set_case_studies_updated_at on public.case_studies;
create trigger set_case_studies_updated_at before update on public.case_studies
  for each row execute function public.set_updated_at();

commit;
