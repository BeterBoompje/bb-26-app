-- ============================================================
-- BB App — Test data voor QR scanner flow
-- ============================================================
-- Voer dit uit in de Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xydywldqkhjuluspuzqr/sql/new
--
-- Bevat:
--   • 1 testklant (Jan Janssen)
--   • 1 testbestelling (#TEST-001) met 4 producten
--   • 1 pickup_target (qr_value = 'TEST-QR-001')
--
-- Boomsoorten & varianten (representatief voor BB 2026):
--   Nordmann Den — 4 maten, met kluit, elk een eigen labelkleur
--   Fijnspar      — 4 maten, zonder kluit, elk een eigen labelkleur
--
-- VEILIG OM OPNIEUW TE DRAAIEN: gebruikt INSERT … ON CONFLICT DO NOTHING
-- en verwijdert alleen testrecords (herkenbaar aan 'TEST-' prefix).
-- ============================================================

-- ── 0. Ruim eventuele oude testdata op ─────────────────────
-- (alleen records met TEST-prefix zodat echte data onaangeroerd blijft)

DELETE FROM pickup_events
  WHERE pickup_target_id IN (
    SELECT id FROM pickup_targets WHERE qr_value = 'TEST-QR-001'
  );

DELETE FROM pickup_targets   WHERE qr_value = 'TEST-QR-001';
DELETE FROM shopify_order_items WHERE shopify_line_item_id LIKE 'TEST-%';
DELETE FROM shopify_orders   WHERE shopify_order_id = 'TEST-ORDER-001';
DELETE FROM shopify_customers WHERE shopify_customer_id = 'TEST-CUSTOMER-001';

-- ── 1. Benodigde IDs ophalen ────────────────────────────────

DO $$
DECLARE
  v_project_id   uuid;
  v_location_id  uuid;
  v_customer_id  uuid;
  v_order_id     uuid;
  v_target_id    uuid;

BEGIN

  -- Project (eerste actieve project)
  SELECT id INTO v_project_id
  FROM projects
  WHERE is_active = true
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Geen actief project gevonden. Voer eerst seed.sql uit.';
  END IF;

  -- Locatie (eerste actieve locatie van dit project)
  SELECT id INTO v_location_id
  FROM locations
  WHERE project_id = v_project_id
    AND is_active = true
  ORDER BY name
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'Geen actieve locatie gevonden voor project %. Voer eerst seed.sql uit.', v_project_id;
  END IF;

  -- ── 2. Testklant ────────────────────────────────────────

  INSERT INTO shopify_customers (
    project_id, shopify_customer_id,
    email, first_name, last_name, phone
  ) VALUES (
    v_project_id, 'TEST-CUSTOMER-001',
    'jan.janssen@test.beterboompje.nl', 'Jan', 'Janssen', '+31612345678'
  )
  ON CONFLICT (shopify_customer_id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name
  RETURNING id INTO v_customer_id;

  -- Fallback als ON CONFLICT niet teruggeeft
  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id
    FROM shopify_customers
    WHERE shopify_customer_id = 'TEST-CUSTOMER-001';
  END IF;

  -- ── 3. Testbestelling ───────────────────────────────────

  INSERT INTO shopify_orders (
    project_id, customer_id,
    shopify_order_id, shopify_order_number, shopify_name,
    financial_status, fulfillment_status
  ) VALUES (
    v_project_id, v_customer_id,
    'TEST-ORDER-001', 9999, '#TEST-001',
    'paid', null
  )
  ON CONFLICT (shopify_order_id) DO UPDATE
    SET financial_status = EXCLUDED.financial_status
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id
    FROM shopify_orders
    WHERE shopify_order_id = 'TEST-ORDER-001';
  END IF;

  -- ── 4. Producten ────────────────────────────────────────
  --
  -- Formaat variant_title: "<maat> / <rootball> / <labelkleur>"
  -- Dit is hetzelfde formaat dat de scanner app parseert.
  --
  -- Nordmann Den (met kluit) — 4 maten
  -- Fijnspar (zonder kluit) — 4 maten
  --
  -- Voor de testbestelling gebruiken we 2 representatieve producten:
  --   1× Nordmann Den 150–175 cm / Met kluit / Groen
  --   1× Fijnspar 125–150 cm / Zonder kluit / Paars
  --
  -- De andere 6 SKUs staan hieronder als commentaar ter referentie.

  INSERT INTO shopify_order_items (
    order_id, shopify_line_item_id,
    sku, title, variant_title,
    quantity, fulfillable_quantity, product_type, requires_shipping
  ) VALUES
    -- Nordmann Den 150–175 cm / Met kluit / Groen label
    (v_order_id, 'TEST-ITEM-NORD-150',
     'NORD-150-KLUIT-GROEN',
     'Nordmann Den',
     '150–175 cm / Met kluit / Groen',
     1, 1, 'tree', false),

    -- Fijnspar 125–150 cm / Zonder kluit / Paars label
    (v_order_id, 'TEST-ITEM-FIJN-125',
     'FIJN-125-KAAL-PAARS',
     'Fijnspar',
     '125–150 cm / Zonder kluit / Paars',
     2, 2, 'tree', false)

  ON CONFLICT (shopify_line_item_id) DO NOTHING;

  -- ── 5. Pickup target ────────────────────────────────────

  INSERT INTO pickup_targets (
    project_id, order_id,
    target_type, qr_value,
    intended_location_id,
    pickup_status, payment_status
  ) VALUES (
    v_project_id, v_order_id,
    'order', 'TEST-QR-001',
    v_location_id,
    'ready', 'paid'
  )
  ON CONFLICT (qr_value) DO UPDATE
    SET pickup_status    = 'ready',
        issued_at        = NULL,
        issued_by        = NULL,
        last_event_id    = NULL,
        eligibility_status = NULL
  RETURNING id INTO v_target_id;

  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE '✓ Testdata aangemaakt / gereset';
  RAISE NOTICE '  Project  : %', v_project_id;
  RAISE NOTICE '  Locatie  : %', v_location_id;
  RAISE NOTICE '  Bestelling: #TEST-001 (id: %)', v_order_id;
  RAISE NOTICE '  QR-waarde: TEST-QR-001 (target id: %)', v_target_id;
  RAISE NOTICE '────────────────────────────────────────────';
  RAISE NOTICE 'Scan QR-waarde TEST-QR-001 of open /app/scan';

END $$;


-- ============================================================
-- REFERENTIE: Alle 8 SKUs voor BB 2026
-- (voeg toe aan shopify_order_items als je ze nodig hebt)
-- ============================================================
--
-- Nordmann Den — met kluit
--   NORD-100-KLUIT-ROOD     | 100–125 cm / Met kluit / Rood
--   NORD-125-KLUIT-BLAUW    | 125–150 cm / Met kluit / Blauw
--   NORD-150-KLUIT-GROEN    | 150–175 cm / Met kluit / Groen   ← in testbestelling
--   NORD-175-KLUIT-GEEL     | 175–200 cm / Met kluit / Geel
--
-- Fijnspar — zonder kluit
--   FIJN-100-KAAL-ORANJE    | 100–125 cm / Zonder kluit / Oranje
--   FIJN-125-KAAL-PAARS     | 125–150 cm / Zonder kluit / Paars ← in testbestelling
--   FIJN-150-KAAL-ROZE      | 150–175 cm / Zonder kluit / Roze
--   FIJN-175-KAAL-WIT       | 175–200 cm / Zonder kluit / Wit
--
-- SKU-structuur: <SOORT>-<MAAT_CM>-<ROOTBALL>-<KLEUR>
-- variant_title-structuur: "<maat> / <kluit> / <kleur>"
--   → door scanner geparseerd als parts[0]=maat, parts[1]=rootball, parts[2]=kleur
-- ============================================================
