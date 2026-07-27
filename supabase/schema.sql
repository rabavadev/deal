create table if not exists stores (
  id bigint generated always as identity primary key,
  source text not null,
  slug text not null,
  name text not null,
  logo_url text,
  branch_address text,
  lat double precision,
  lng double precision,
  distance_miles numeric,
  unique (source, slug)
);

create table if not exists flyers (
  id bigint generated always as identity primary key,
  source text not null,
  external_id text not null,
  merchant_slug text not null,
  merchant_name text not null,
  title text,
  valid_from timestamptz,
  valid_to timestamptz,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists deals (
  id bigint generated always as identity primary key,
  flyer_id bigint not null references flyers(id) on delete cascade,
  source text not null,
  external_id text not null,
  merchant_slug text not null,
  name text not null,
  normalized_name text not null,
  description text,
  price numeric,
  original_price numeric,
  prime_price numeric,
  unit text,
  price_text text,
  sale_story text,
  category text not null default 'other',
  image_url text,
  crop jsonb,
  valid_from timestamptz,
  valid_to timestamptz,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  discount_pct numeric generated always as (
    case when original_price > 0 and price is not null and price < original_price
         then round((1 - price / original_price) * 100) end
  ) stored,
  unique (source, external_id)
);

create index if not exists deals_validity_idx on deals (valid_from, valid_to);
create index if not exists deals_merchant_idx on deals (merchant_slug);
create index if not exists deals_name_idx on deals (normalized_name);

create table if not exists ingest_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  flyer_count integer not null default 0,
  deal_count integer not null default 0,
  error text
);

alter table stores enable row level security;
alter table flyers enable row level security;
alter table deals enable row level security;
alter table ingest_runs enable row level security;
create policy "public read stores" on stores for select using (true);
create policy "public read flyers" on flyers for select using (true);
create policy "public read deals" on deals for select using (true);
create policy "public read ingest_runs" on ingest_runs for select using (true);
