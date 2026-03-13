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
