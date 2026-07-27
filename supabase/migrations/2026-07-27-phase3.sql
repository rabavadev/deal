-- Phase 3: unit prices, history flags, push, shared lists, dinner suggestions

alter table deals
  add column if not exists size_qty numeric,
  add column if not exists size_unit text,
  add column if not exists unit_price numeric,
  add column if not exists hist_min_price numeric,
  add column if not exists hist_weeks integer;

create table if not exists push_subscriptions (
  device_id text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists watches (
  device_id text not null,
  term text not null,
  max_price numeric,
  created_at timestamptz not null default now(),
  primary key (device_id, term)
);

create table if not exists notified (
  device_id text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  primary key (device_id, dedupe_key)
);

create table if not exists lists (
  code text primary key,
  created_at timestamptz not null default now()
);

create table if not exists list_items (
  code text not null references lists(code) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  primary key (code, text)
);

create table if not exists suggestions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table push_subscriptions enable row level security;
alter table watches enable row level security;
alter table notified enable row level security;
alter table lists enable row level security;
alter table list_items enable row level security;
alter table suggestions enable row level security;
-- suggestions are harmless to read publicly; everything else is service-role only
create policy "public read suggestions" on suggestions for select using (true);

create or replace function refresh_history_flags() returns void
language sql security definer as $$
  update deals d set
    hist_min_price = h.minp,
    hist_weeks = h.weeks
  from (
    select normalized_name, merchant_slug,
           min(price) as minp,
           count(distinct valid_from) as weeks
    from deals
    where price is not null
    group by normalized_name, merchant_slug
  ) h
  where d.normalized_name = h.normalized_name
    and d.merchant_slug = h.merchant_slug
    and d.price is not null;
$$;
