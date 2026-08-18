-- ============================================================================
-- Phase 4: crawl_events — AI-crawler hits + AI-referral visits.
-- Feeds the admin "AI Crawlers" page. Apply after 20260814_phase3_cms_extensions.sql.
-- ============================================================================

begin;

create table if not exists public.crawl_events (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('crawl', 'referral')),
  bot         text,            -- normalized bot name for kind='crawl' (e.g. 'GPTBot')
  engine      text,            -- AI engine for kind='referral' (e.g. 'chatgpt')
  path        text not null,   -- crawled/visited path
  referer     text,            -- raw referer for referrals
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists crawl_events_created_idx on public.crawl_events (created_at desc);
create index if not exists crawl_events_kind_bot_idx on public.crawl_events (kind, bot);
create index if not exists crawl_events_kind_engine_idx on public.crawl_events (kind, engine);

alter table public.crawl_events enable row level security;

-- Beacons / edge middleware use the anon key: insert-only, no read-back.
drop policy if exists "crawl_events anon insert" on public.crawl_events;
create policy "crawl_events anon insert"
  on public.crawl_events for insert
  with check (true);

-- Only authenticated admin users can read the log.
drop policy if exists "crawl_events authenticated read" on public.crawl_events;
create policy "crawl_events authenticated read"
  on public.crawl_events for select to authenticated
  using (true);

grant insert on public.crawl_events to anon;
grant select on public.crawl_events to authenticated;

commit;
