-- ══════════════════════════════════════════════════════════════
-- Locations: ontbrekende write-policies toevoegen
-- De SELECT-policy (locations_project_select) bestaat al.
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "locations_admin_insert"
  ON public.locations
  FOR INSERT
  WITH CHECK (app.is_admin());

CREATE POLICY "locations_admin_update"
  ON public.locations
  FOR UPDATE
  USING (app.is_admin())
  WITH CHECK (app.is_admin());

CREATE POLICY "locations_admin_delete"
  ON public.locations
  FOR DELETE
  USING (app.is_admin());
