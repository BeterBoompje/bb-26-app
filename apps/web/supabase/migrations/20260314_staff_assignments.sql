-- ============================================================
-- Migratie: Medewerker-assignments
-- 2026-03-14
--
-- 1. Enum-waarde 'distributor' toevoegen aan staff_role
-- 2. location_assignments tabel (user × locatie, met rolle-niveau)
-- 3. distributor_assignments tabel (user × distributeur, met rol-niveau)
-- ============================================================


-- ── 1. Enum uitbreiden ────────────────────────────────────────

ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'distributor';


-- ── 2. location_assignments ───────────────────────────────────

CREATE TABLE public.location_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  location_id uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  role_level  text        NOT NULL DEFAULT 'staff'
                          CHECK (role_level IN ('staff', 'manager')),
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, location_id)
);

CREATE INDEX location_assignments_user_idx     ON public.location_assignments (user_id);
CREATE INDEX location_assignments_location_idx ON public.location_assignments (location_id);

ALTER TABLE public.location_assignments ENABLE ROW LEVEL SECURITY;

-- Admin: volledig beheer
CREATE POLICY "location_assignments_admin_all"
  ON public.location_assignments
  FOR ALL
  TO authenticated
  USING (app.is_admin())
  WITH CHECK (app.is_admin());

-- Staff: eigen assignments lezen
CREATE POLICY "location_assignments_self_select"
  ON public.location_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ── 3. distributor_assignments ────────────────────────────────

CREATE TABLE public.distributor_assignments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  distributor_id uuid        NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  role_level     text        NOT NULL DEFAULT 'staff'
                             CHECK (role_level IN ('staff', 'manager')),
  created_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, distributor_id)
);

CREATE INDEX distributor_assignments_user_idx        ON public.distributor_assignments (user_id);
CREATE INDEX distributor_assignments_distributor_idx ON public.distributor_assignments (distributor_id);

ALTER TABLE public.distributor_assignments ENABLE ROW LEVEL SECURITY;

-- Admin: volledig beheer
CREATE POLICY "distributor_assignments_admin_all"
  ON public.distributor_assignments
  FOR ALL
  TO authenticated
  USING (app.is_admin())
  WITH CHECK (app.is_admin());

-- Staff: eigen assignments lezen
CREATE POLICY "distributor_assignments_self_select"
  ON public.distributor_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ── 4. staff_profiles: admin kan alle profielen bijwerken ─────
-- (was al read-only met admin_select, maar er was nog geen update-policy)

CREATE POLICY "staff_profiles_admin_update"
  ON public.staff_profiles
  FOR UPDATE
  TO authenticated
  USING (app.is_admin())
  WITH CHECK (app.is_admin());

CREATE POLICY "staff_profiles_admin_insert"
  ON public.staff_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (app.is_admin());
