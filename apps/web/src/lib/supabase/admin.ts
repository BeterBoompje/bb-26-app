import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client met service role key.
 * Omzeilt RLS volledig — gebruik ALLEEN in vertrouwde server-side code
 * (API routes met expliciete admin auth check via requireAdmin).
 *
 * Vereist: SUPABASE_SERVICE_ROLE_KEY in .env
 * Haal de key op via: Supabase dashboard → Project Settings → API → service_role
 */
export function createAdminClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ontbreekt in .env. " +
      "Ga naar Supabase dashboard → Project Settings → API → service_role key."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
