-- ══════════════════════════════════════════════════════════════
-- Partners: voeg partner_type toe aan distributors
-- ══════════════════════════════════════════════════════════════
-- Bestaande distributors zijn afhaallocaties → default 'pickup_location'
-- Leveranciers (Randwijk, D&K, Plantsome) kunnen na migratie via de
-- Partners-pagina worden aangemaakt of bijgewerkt.

DO $$ BEGIN
  CREATE TYPE public.partner_type AS ENUM ('supplier', 'pickup_location', 'both');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS partner_type public.partner_type NOT NULL DEFAULT 'pickup_location';
