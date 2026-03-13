-- ============================================================
-- Migratie: locatie velden uitbreiden + location_season_details
--
-- Waarom:
--   - locations heeft nu alleen name, code, type, address_json, meta
--   - geo-coördinaten, stad en adres horen op de locatie zelf
--   - pickup-datums, statussen en content zijn seizoensgebonden
--   - dezelfde locatie (bv. Steck Utrecht) bestaat in meerdere seizoenen
-- ============================================================


-- ── 1. LOCATIONS uitbreiden met seizoensoverstijgende velden ──

alter table public.locations
  add column if not exists city          text,
  add column if not exists address       text,
  add column if not exists latitude      numeric(10, 7),
  add column if not exists longitude     numeric(10, 7),
  add column if not exists website_url   text,
  add column if not exists webflow_item_id text;

create index if not exists locations_city_idx
  on public.locations (project_id, city);

create index if not exists locations_webflow_item_id_idx
  on public.locations (webflow_item_id);


-- ── 2. LOCATION_SEASON_DETAILS ───────────────────────────────
-- Seizoensgebonden operationele data per locatie.
-- Afgeleid van de Webflow CMS-velden.

create table public.location_season_details (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  season_id   uuid not null references public.seasons(id) on delete cascade,

  -- Webflow-statussen
  is_open              boolean not null default true,
  is_sold_out          boolean not null default false,
  is_new_location      boolean not null default false,
  is_tbd               boolean not null default false,   -- nader bepaald
  is_no_longer_pickup  boolean not null default false,

  -- Pickup windows (twee slots, zoals Webflow)
  pickup_window_1_date  date,
  pickup_window_1_hours text,
  pickup_window_2_date  date,
  pickup_window_2_hours text,

  -- Terugbreng
  return_date            date,
  return_hours           text,
  early_return_allowed   boolean not null default false,

  -- Display/content (uit Webflow CMS)
  photo_url        text,
  photo_alt        text,
  eventix_link     text,
  meta_seo         text,
  about_pickup     text,  -- HTML richtext
  about            text,  -- HTML richtext
  extra_info       text,  -- HTML richtext

  -- Webflow sync-tracking
  webflow_slug       text,
  webflow_synced_at  timestamptz,

  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  unique (location_id, season_id)
);

create trigger location_season_details_set_updated_at
before update on public.location_season_details
for each row execute function public.set_updated_at();

create index location_season_details_location_id_idx
  on public.location_season_details (location_id);

create index location_season_details_season_id_idx
  on public.location_season_details (season_id, is_open, is_no_longer_pickup);

alter table public.location_season_details enable row level security;

create policy "location_season_details_project_select"
on public.location_season_details
for select
to authenticated
using (
  exists (
    select 1
    from public.locations l
    where l.id = location_season_details.location_id
      and app.user_has_project_access(l.project_id)
  )
);
