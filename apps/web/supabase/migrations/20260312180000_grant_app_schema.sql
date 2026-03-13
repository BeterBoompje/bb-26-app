-- ============================================================
-- Grant: app-schema functies toegankelijk maken voor authenticated
--
-- Waarom: de RLS-policies op tables als locations, projects, enz.
-- roepen functies aan in het 'app' schema (is_admin,
-- user_has_project_access, etc.). Zonder USAGE op het schema
-- en EXECUTE op de functies krijgt de authenticated role
-- "permission denied for schema app".
-- ============================================================

grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;
