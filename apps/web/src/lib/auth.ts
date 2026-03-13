import type { AstroCookies } from "astro";
import { createServerClient, clearAuthCookies } from "./supabase/server";

/**
 * Controleer auth in een beveiligde pagina.
 * Retourneert sessie en supabase client, of null als niet ingelogd.
 */
export async function requireAuth(cookies: AstroCookies) {
  const { supabase, session } = await createServerClient(cookies);

  if (!session) {
    return null;
  }

  return { supabase, session };
}

/**
 * Vereist admin rol (staff_profiles.role = 'admin').
 * Geeft null als niet ingelogd (redirect naar /signin).
 * Geeft null met redirect naar /app als rol niet admin is.
 */
export async function requireAdmin(cookies: AstroCookies) {
  const { supabase, session } = await createServerClient(cookies);

  if (!session) {
    return null;
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("id, full_name, email, role, default_location_id, is_active")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== "admin") {
    return { supabase, session, profile: null, forbidden: true };
  }

  return { supabase, session, profile, forbidden: false };
}

/**
 * Vereist actief staff (scanner, location_manager of admin).
 * Geeft null als niet ingelogd.
 */
export async function requireStaff(cookies: AstroCookies) {
  const { supabase, session } = await createServerClient(cookies);

  if (!session) {
    return null;
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("id, full_name, email, role, default_location_id, is_active")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.is_active) {
    return { supabase, session, profile: null, forbidden: true };
  }

  return { supabase, session, profile, forbidden: false };
}
