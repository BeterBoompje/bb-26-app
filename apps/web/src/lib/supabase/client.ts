import { createClient } from "@supabase/supabase-js";

/**
 * Publieke Supabase client voor browser- en licht servergebruik.
 * Elke aanroep maakt een nieuwe instance — geen gedeelde singleton.
 */
export function createSupabaseClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: "pkce",
      },
    },
  );
}
