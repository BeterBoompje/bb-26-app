-- ============================================================
-- Seed: BB 2026
--
-- Run dit in de Supabase SQL Editor nadat alle migraties
-- zijn uitgevoerd.
--
-- Aanpassen voor elke locatie:
--   1. Voeg rijen toe aan de INSERT voor locations
--   2. Voeg bijbehorende rijen toe aan location_season_details
-- ============================================================


-- ── 0. PROJECT: BB ───────────────────────────────────────────
-- Project eerst, zodat we de id kunnen gebruiken voor de admin.

insert into public.projects (slug, name, code, is_active)
values ('bb', 'Beter Boompje', 'BB', true)
on conflict (slug) do nothing;


-- ── 1. ADMIN GEBRUIKER ───────────────────────────────────────
-- User aangemaakt via Supabase Dashboard op 2026-03-12.
-- project_id wordt gekoppeld aan het BB-project.

insert into public.staff_profiles (id, project_id, full_name, email, role, is_active)
select
  '1f7152bb-4920-4400-bd67-14e3085c47fa',
  p.id,
  'Alex Degeling',
  'alex@beterboompje.nl',
  'admin',
  true
from public.projects p
where p.slug = 'bb'
on conflict (id) do update
  set project_id = excluded.project_id;


-- ── 2. SEIZOEN: BB 2026 ──────────────────────────────────────

insert into public.seasons (project_id, code, year, label, source_system, is_active)
select
  p.id,
  'bb-2026',
  2026,
  'BB 2026',
  'shopify',
  true
from public.projects p
where p.slug = 'bb'
on conflict (project_id, code) do nothing;


-- ── 3. LOCATIES (seizoensoverstijgend) ───────────────────────
-- Voeg hier alle BB-locaties toe. code moet uniek zijn per project.

with proj as (
  select id from public.projects where slug = 'bb'
)
insert into public.locations (
  project_id,
  name,
  code,
  type,
  city,
  address,
  latitude,
  longitude,
  website_url,
  webflow_item_id,
  is_active
)
select
  proj.id,
  loc.name,
  loc.code,
  'pickup'::public.location_type,
  loc.city,
  loc.address,
  loc.latitude,
  loc.longitude,
  loc.website_url,
  loc.webflow_item_id,
  true
from proj, (values
  -- (name,              code,              city,       address,                      lat,         lng,        website_url,                         webflow_item_id)
  ('Steck Utrecht',      'steck-utrecht',   'Utrecht',  'Amsterdamsestraatweg 455, Utrecht', 52.1154, 5.0900,  'https://www.steck.nl',              'webflow-steck-utrecht'),
  ('De Fietser Haarlem', 'fietser-haarlem', 'Haarlem',  'Grote Houtstraat 100, Haarlem',    52.3800, 4.6383,  'https://www.defietser.nl',          'webflow-fietser-haarlem')
  -- Voeg hier meer locaties toe ↓
) as loc(name, code, city, address, latitude, longitude, website_url, webflow_item_id)
on conflict (project_id, code) do update
  set
    name           = excluded.name,
    city           = excluded.city,
    address        = excluded.address,
    latitude       = excluded.latitude,
    longitude      = excluded.longitude,
    website_url    = excluded.website_url,
    webflow_item_id = excluded.webflow_item_id;


-- ── 4. LOCATIE SEIZOENSDETAILS (BB 2026) ─────────────────────
-- Eén rij per locatie × seizoen.
-- Pas de velden aan op basis van de actuele Webflow CMS-data.

with
  proj   as (select id from public.projects where slug = 'bb'),
  season as (select s.id from public.seasons s join proj on s.project_id = proj.id where s.code = 'bb-2026')
insert into public.location_season_details (
  location_id,
  season_id,

  -- Statussen
  is_open,
  is_sold_out,
  is_new_location,
  is_tbd,
  is_no_longer_pickup,

  -- Afhaal-windows
  pickup_window_1_date,
  pickup_window_1_hours,
  pickup_window_2_date,
  pickup_window_2_hours,

  -- Terugbreng
  return_date,
  return_hours,
  early_return_allowed,

  -- Content / Webflow
  webflow_slug,
  photo_url,
  photo_alt,
  eventix_link,
  about_pickup,
  about,
  extra_info
)
select
  l.id,
  season.id,
  d.is_open,
  d.is_sold_out,
  d.is_new_location,
  d.is_tbd,
  d.is_no_longer_pickup,
  d.pickup_window_1_date::date,
  d.pickup_window_1_hours,
  d.pickup_window_2_date::date,
  d.pickup_window_2_hours,
  d.return_date::date,
  d.return_hours,
  d.early_return_allowed,
  d.webflow_slug,
  d.photo_url,
  d.photo_alt,
  d.eventix_link,
  d.about_pickup,
  d.about,
  d.extra_info
from season, (values
  --  location_code,         is_open,  is_sold_out, is_new, is_tbd, no_longer,
  --  pw1_date,       pw1_hours,    pw2_date,       pw2_hours,
  --  return_date,    return_hours, early_return,
  --  slug,                  photo_url, photo_alt,          eventix, about_pickup, about, extra_info
  (
    'steck-utrecht',
    true,   false,  false,  false,  false,
    '2026-11-28', '10:00 – 17:00',  null,            null,
    '2027-01-15', '09:00 – 17:00',  false,
    'steck-utrecht-bb-2026',
    null,
    'Steck Utrecht',
    null,
    '<p>Je kunt je boom afhalen bij Steck Utrecht.</p>',
    '<p>Steck is een gezellige fietsenwinkel in Utrecht.</p>',
    null
  ),
  (
    'fietser-haarlem',
    true,   false,  false,  false,  false,
    '2026-11-29', '10:00 – 17:00',  null,            null,
    '2027-01-15', '09:00 – 17:00',  false,
    'fietser-haarlem-bb-2026',
    null,
    'De Fietser Haarlem',
    null,
    '<p>Je kunt je boom afhalen bij De Fietser in Haarlem.</p>',
    '<p>De Fietser is een bekende fietswinkel in het centrum van Haarlem.</p>',
    null
  )
  -- Voeg hier meer rijen toe ↓
) as d(
  location_code,
  is_open, is_sold_out, is_new_location, is_tbd, is_no_longer_pickup,
  pickup_window_1_date, pickup_window_1_hours, pickup_window_2_date, pickup_window_2_hours,
  return_date, return_hours, early_return_allowed,
  webflow_slug, photo_url, photo_alt, eventix_link, about_pickup, about, extra_info
)
join public.locations l
  on l.code = d.location_code
  and l.project_id = (select id from public.projects where slug = 'bb')
on conflict (location_id, season_id) do update
  set
    is_open                = excluded.is_open,
    is_sold_out            = excluded.is_sold_out,
    is_new_location        = excluded.is_new_location,
    is_tbd                 = excluded.is_tbd,
    is_no_longer_pickup    = excluded.is_no_longer_pickup,
    pickup_window_1_date   = excluded.pickup_window_1_date,
    pickup_window_1_hours  = excluded.pickup_window_1_hours,
    pickup_window_2_date   = excluded.pickup_window_2_date,
    pickup_window_2_hours  = excluded.pickup_window_2_hours,
    return_date            = excluded.return_date,
    return_hours           = excluded.return_hours,
    early_return_allowed   = excluded.early_return_allowed,
    webflow_slug           = excluded.webflow_slug,
    photo_url              = excluded.photo_url,
    photo_alt              = excluded.photo_alt,
    eventix_link           = excluded.eventix_link,
    about_pickup           = excluded.about_pickup,
    about                  = excluded.about,
    extra_info             = excluded.extra_info,
    updated_at             = timezone('utc', now());


-- ── 5. VERIFICATIE ───────────────────────────────────────────
-- Draai dit na het seeden om te controleren:

select
  l.name        as locatie,
  l.city,
  s.label       as seizoen,
  lsd.is_open,
  lsd.pickup_window_1_date,
  lsd.pickup_window_1_hours,
  lsd.return_date
from public.location_season_details lsd
join public.locations l on l.id = lsd.location_id
join public.seasons s   on s.id = lsd.season_id
order by l.name;


-- ── PRODUCT VARIANTEN ─────────────────────────────────────────
-- Boomcategorieën zoals gebruikt in het voorraadsysteem en de paklijsten.
-- Gebaseerd op de BB-paklijsttemplate en teller-2000.js categorieën.
--
-- sku_pattern = code zoals gebruikt in Shopify SKUs en inventory_lines.category_code
-- display_label = gebruiksvriendelijke naam voor UI
-- color_hex / color_name = kleurcodering uit de paklijst (geel/wit/paars/blauw etc.)
-- has_rootball = met kluit (MET) of zonder (ZONDER)
-- sort_order = volgorde op scherm (MET klein→groot, dan ZONDER klein→groot)

insert into public.product_variants
  (project_id, sku_pattern, display_label, color_hex, color_name, has_rootball, size_from_cm, size_to_cm, sort_order)
select
  p.id,
  v.sku_pattern,
  v.display_label,
  v.color_hex,
  v.color_name,
  v.has_rootball,
  v.size_from_cm,
  v.size_to_cm,
  v.sort_order
from public.projects p,
(values
  -- MET KLUIT (Picea / Nordmann met kluit)
  ('MET-100-125',  'Picea met kluit 100–125 cm',        '#FFFF00', 'geel',   true,  100, 125, 10),
  ('MET-125-150',  'Picea met kluit 125–150 cm',        '#FFFFFF', 'wit',    true,  125, 150, 20),
  ('MET-150-175',  'Picea met kluit 150–175 cm',        '#A855F7', 'paars',  true,  150, 175, 30),
  ('MET-175-200',  'Picea met kluit 175–200 cm',        '#3B82F6', 'blauw',  true,  175, 200, 40),
  -- ZONDER KLUIT (Nordmann zonder kluit)
  ('ZONDER-150-175', 'Nordmann zonder kluit 150–175 cm', '#EF4444', 'rood',  false, 150, 175, 50),
  ('ZONDER-175-200', 'Nordmann zonder kluit 175–200 cm', '#FFFFFF', 'wit',   false, 175, 200, 60),
  ('ZONDER-200-250', 'Nordmann zonder kluit 200–250 cm', '#3B82F6', 'blauw', false, 200, 250, 70),
  ('ZONDER-250-300', 'Nordmann zonder kluit 250–300 cm', '#22C55E', 'groen', false, 250, 300, 80)
) as v(sku_pattern, display_label, color_hex, color_name, has_rootball, size_from_cm, size_to_cm, sort_order)
where p.slug = 'bb'
on conflict do nothing;
