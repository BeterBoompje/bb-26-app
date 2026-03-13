-- ============================================================
-- Test data: volledige scan-flow zonder Shopify sync
--
-- Draai dit in de Supabase SQL Editor.
-- Het maakt één nep-bestelling aan zodat je de scanner kunt
-- testen vóórdat de Shopify-integratie gebouwd is.
--
-- QR-waarde om te scannen: 1234567890
-- (simuleer Shopify order.id als string in de QR code)
-- ============================================================


-- ── Cleanup: verwijder eerder aangemaakte testdata ────────────
-- Verwijder in omgekeerde volgorde vanwege foreign keys

delete from public.pickup_targets
  where qr_value = '1234567890';

delete from public.shopify_orders
  where shopify_order_id = '1234567890';

delete from public.shopify_customers
  where shopify_customer_id = 'test-customer-001';


-- ── 1. Klant aanmaken ────────────────────────────────────────

insert into public.shopify_customers (
  project_id,
  shopify_customer_id,
  email,
  first_name,
  last_name,
  phone
)
select
  p.id,
  'test-customer-001',
  'jan.janssen@example.com',
  'Jan',
  'Janssen',
  '+31612345678'
from public.projects p
where p.slug = 'bb';


-- ── 2. Bestelling aanmaken ───────────────────────────────────
-- shopify_order_id = '1234567890'  ← dit is de QR-waarde
-- shopify_name     = '#1001'       ← het zichtbare bestelnummer in Shopify

insert into public.shopify_orders (
  project_id,
  customer_id,
  shopify_order_id,
  shopify_order_number,
  shopify_name,
  currency,
  financial_status,
  fulfillment_status,
  cancelled_at,
  order_created_at,
  synced_at
)
select
  p.id,
  sc.id,
  '1234567890',
  '1001',
  '#1001',
  'EUR',
  'paid',
  null,
  null,
  timezone('utc', now()),
  timezone('utc', now())
from public.projects p
join public.shopify_customers sc
  on sc.project_id = p.id
  and sc.shopify_customer_id = 'test-customer-001'
where p.slug = 'bb';


-- ── 3. Pickup target aanmaken ────────────────────────────────
-- qr_value = '1234567890'  ← de exacte string uit de QR code (= Shopify order.id)
-- intended_location_id = null → elke locatie is geldig (makkelijker testen)
--
-- Wil je de locatiecheck testen?  Verander null naar:
--   (select id from public.locations where code = 'steck-utrecht')

insert into public.pickup_targets (
  project_id,
  order_id,
  target_type,
  qr_value,
  intended_location_id,
  pickup_status,
  payment_status,
  eligibility_status
)
select
  p.id,
  so.id,
  'order',
  '1234567890',
  null,   -- ← null = accepteer bij elke locatie
  'ready',
  'paid',
  'manual_review'  -- wordt overschreven door de RPC
from public.projects p
join public.shopify_orders so
  on so.project_id = p.id
  and so.shopify_order_id = '1234567890'
where p.slug = 'bb';


-- ── 4. Verificatie ───────────────────────────────────────────
-- Controleer of alles correct is aangemaakt:

select
  pt.qr_value,
  pt.pickup_status,
  pt.payment_status,
  so.shopify_name     as bestelling,
  sc.first_name || ' ' || sc.last_name as klant,
  sc.email
from public.pickup_targets pt
join public.shopify_orders so on so.id = pt.order_id
join public.shopify_customers sc on sc.id = so.customer_id
where pt.qr_value = '1234567890';
