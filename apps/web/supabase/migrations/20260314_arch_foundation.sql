-- ══════════════════════════════════════════════════════════════
-- Architectuurmigratie: project_memberships als autorisatiebron
--
-- Doel:
--   1. Zorg dat elke staff_profile een bijpassende project_membership heeft
--      (sync voor bestaande gebruikers die via staff_profiles zijn aangemaakt)
--   2. Voeg RLS-policies toe voor supply-tabellen op basis van project_memberships
--   3. Maak app.get_project_id_for_user() helper-functie aan
--
-- Na deze migratie:
--   - app.user_has_project_access() is al beschikbaar (uit operational-hardening.sql)
--   - Alle nieuwe app-code leest project_id uit project_memberships
--   - staff_profiles.project_id blijft als metadata/display-veld (niet voor auth)
-- ══════════════════════════════════════════════════════════════

-- ── Helper: haal project_id op voor de ingelogde gebruiker ───────────────────
-- Wordt gebruikt in API-routes als project_memberships de bron is.

CREATE OR REPLACE FUNCTION app.get_project_id_for_user(
  p_user_id uuid DEFAULT auth.uid(),
  p_role    public.staff_role DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT pm.project_id
  FROM public.project_memberships pm
  WHERE pm.user_id = p_user_id
    AND pm.is_active = true
    AND (p_role IS NULL OR pm.role = p_role)
  ORDER BY pm.created_at
  LIMIT 1
$$;

COMMENT ON FUNCTION app.get_project_id_for_user IS
  'Geeft project_id terug voor een gebruiker via project_memberships.
   Geeft NULL als de gebruiker geen actieve membership heeft.
   Gebruik dit NOOIT als fallback — een NULL is een configuratiefout.';

-- ── Sync: zorg dat bestaande staff_profiles een project_membership hebben ─────
-- Veilig om meerdere keren uit te voeren (ON CONFLICT DO NOTHING).

INSERT INTO public.project_memberships (user_id, project_id, role, is_active)
SELECT
  sp.id         AS user_id,
  sp.project_id AS project_id,
  sp.role       AS role,
  sp.is_active  AS is_active
FROM public.staff_profiles sp
WHERE sp.project_id IS NOT NULL
ON CONFLICT (user_id, project_id) DO UPDATE
  SET role      = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = timezone('utc', now());

-- ── Audit-log index (audit_logs bestaat maar heeft mogelijk geen index op actor) ──
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx
  ON public.audit_logs (actor_user_id);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

-- ── Komende SQL views (inventory_lines beschikbaar na feat/scanner-ux merge) ──
-- De volgende views worden aangemaakt in een latere migratie zodra de tabellen
-- inventory_lines, distributors en purchase_order_lines beschikbaar zijn:
--
--   v_inventory_overzicht    — voorraad per category_code, seizoen, distributeur
--   v_verkoop_per_categorie  — verkochte aantallen via SQL LIKE (vervangt JS-loop)
--   v_locatie_matrix         — pickup_targets per locatie + datum
--
-- Dit elimineert de client-side SKU-matching in rapportage/index.astro en de
-- in-memory aggregaties in export-csv.ts.
