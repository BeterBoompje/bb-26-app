-- ══════════════════════════════════════════════════════════════
-- Centrale productbron: product_variants
-- ══════════════════════════════════════════════════════════════
-- product_variants is de master-lijst van alle boomtypen per project.
-- SKU-patroon (sku_pattern) matcht op categorie_code in inventory_lines
-- en categorie_code in purchase_order_lines.
-- Labelkleur is seizoensafhankelijk → product_variant_season_colors.

CREATE TABLE IF NOT EXISTS public.product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,

  -- Uniek patroon dat overeenkomt met category_code / sku prefix
  -- Bijv: "MET-100-125", "ZONDER-175-200"
  sku_pattern   text NOT NULL,

  -- Weergave-label voor UI
  display_label text,

  -- Producttype: "met_kluit" | "zonder_kluit" | "overig"
  product_type  text,

  -- Standaard labelkleur (kan per seizoen worden overschreven)
  color_name    text,

  -- Sorteervolgorde voor overzichten
  sort_order    int NOT NULL DEFAULT 0,

  is_active     boolean NOT NULL DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),

  UNIQUE (project_id, sku_pattern)
);

CREATE INDEX IF NOT EXISTS product_variants_project_idx
  ON public.product_variants (project_id, sort_order);

-- Seizoensspecifieke labelkleur-overrides
-- Labelkleur wisselt bijna elk jaar; dit tabel houdt de history bij.
CREATE TABLE IF NOT EXISTS public.product_variant_season_colors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id  uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  season_id           uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  color_name          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (product_variant_id, season_id)
);

-- Auto updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = timezone('utc', now()); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'product_variants_updated_at'
      AND tgrelid = 'public.product_variants'::regclass
  ) THEN
    CREATE TRIGGER product_variants_updated_at
      BEFORE UPDATE ON public.product_variants
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_season_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_admin_all" ON public.product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.project_id = product_variants.project_id
        AND sp.role = 'admin'
        AND sp.is_active = true
    )
  );

CREATE POLICY "pv_staff_read" ON public.product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.project_id = product_variants.project_id
        AND sp.is_active = true
    )
  );

CREATE POLICY "pvsc_admin_all" ON public.product_variant_season_colors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.product_variants pv
      JOIN public.staff_profiles sp ON sp.project_id = pv.project_id
      WHERE pv.id = product_variant_season_colors.product_variant_id
        AND sp.id = auth.uid()
        AND sp.role = 'admin'
        AND sp.is_active = true
    )
  );

CREATE POLICY "pvsc_staff_read" ON public.product_variant_season_colors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.product_variants pv
      JOIN public.staff_profiles sp ON sp.project_id = pv.project_id
      WHERE pv.id = product_variant_season_colors.product_variant_id
        AND sp.id = auth.uid()
        AND sp.is_active = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_season_colors TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- Locations uitbreiden voor pickup-beheer
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'lat'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN lat numeric(10,7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'lng'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN lng numeric(10,7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'website_url'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN website_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'eventix_url'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN eventix_url text;
  END IF;

  -- is_open: locatie open voor pickup (operationeel)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'is_open'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN is_open boolean NOT NULL DEFAULT true;
  END IF;

  -- is_sold_out: uitverkocht voor dit seizoen
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'is_sold_out'
  ) THEN
    ALTER TABLE public.locations ADD COLUMN is_sold_out boolean NOT NULL DEFAULT false;
  END IF;
END $$;