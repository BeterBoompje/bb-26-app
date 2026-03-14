-- ══════════════════════════════════════════════════════════════
-- Inkoop-module: purchase_order_lines
-- Vervangt de INKOOP-sheet uit het Google Sheets systeem.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.purchase_order_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  season_id         uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,

  -- Groepering (replica van DOEL-kolom in Google Sheets)
  -- Waarden: "Randijk | BB Pickups", "D&K | Deco & pick up",
  --          "Plantsome | BB verzenden", "STECK inkoop", "Plantsome inkoop"
  doel              text NOT NULL,

  -- Leverancier & planning
  leverancier       text NOT NULL DEFAULT '',
  levering_week     text,
  status            text NOT NULL DEFAULT 'optie'
                    CHECK (status IN ('optie', 'besteld', 'geleverd', 'geannuleerd')),

  -- Product-informatie
  categorie_code    text NOT NULL,   -- bijv. "MET-100-125"
  product_code      text,            -- leverancier-specifiek, bijv. "20341"
  product_naam      text,
  label_kleur       text,            -- "GEEL", "WIT", "PAARS", "BLAUW", "ROOD", "GROEN"
  bb_wensen         text,            -- "Paarse zak / BB label"
  sku               text,            -- Shopify SKU

  -- Bestemming
  bestemming        text,            -- "Pickups", "D&K Pickups Waddinxveen", …
  leverings_locatie text,            -- "Randijk Glind", "Waddinxveen", …

  -- Prijzen (excl. BTW tenzij anders aangegeven)
  inkoop_excl       numeric(10,4),
  fulfillment_excl  numeric(10,4),
  verzend_excl      numeric(10,4),
  afdracht_excl     numeric(10,4),
  green_return      numeric(10,4),
  handelsprijs      numeric(10,4),
  verkoop_incl      numeric(10,4),
  verkoop_excl      numeric(10,4),

  -- Aantallen
  aantal            integer NOT NULL DEFAULT 0,

  -- Notities
  opmerkingen       text,

  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at        timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Index voor snelle filters per seizoen en project
CREATE INDEX purchase_order_lines_season_idx ON public.purchase_order_lines (season_id, project_id);
CREATE INDEX purchase_order_lines_doel_idx   ON public.purchase_order_lines (project_id, doel);

-- Automatisch updated_at bijhouden
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = timezone('utc', now()); RETURN NEW; END;
$$;

-- (De functie bestaat mogelijk al van andere tabellen, dus CREATE OR REPLACE is veilig)
CREATE TRIGGER purchase_order_lines_updated_at
  BEFORE UPDATE ON public.purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

-- Admins mogen alles binnen hun eigen project
CREATE POLICY "pol_pol_admin_all"
  ON public.purchase_order_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.project_id = purchase_order_lines.project_id
        AND sp.role = 'admin'
        AND sp.is_active = true
    )
  );

-- Location managers mogen lezen
CREATE POLICY "pol_inkoop_lm_read"
  ON public.purchase_order_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.project_id = purchase_order_lines.project_id
        AND sp.role IN ('admin', 'location_manager')
        AND sp.is_active = true
    )
  );

-- Grants voor de app-gebruiker
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.purchase_order_lines TO authenticated;
