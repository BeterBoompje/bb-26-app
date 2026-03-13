import type { AstroCookies } from "astro";
import { createSupabaseClient } from "./client";

/**
 * Request-scoped Supabase client voor server-side gebruik.
 * Leest tokens uit cookies, herstelt de sessie, en schrijft
 * geroteerde tokens terug.
 */
export async function createServerClient(cookies: AstroCookies) {
  const supabase = createSupabaseClient();

  const accessToken = cookies.get("sb-access-token")?.value;
  const refreshToken = cookies.get("sb-refresh-token")?.value;

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
      return { supabase, session: null };
    }

    // Schrijf geroteerde tokens terug
    if (data.session) {
      if (data.session.access_token !== accessToken) {
        setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
      }
      return { supabase, session: data.session };
    }
  }

  return { supabase, session: null };
}

/**
 * Zet auth-cookies met de juiste beveiligingsinstellingen.
 */
export function setAuthCookies(
  cookies: AstroCookies,
  accessToken: string,
  refreshToken: string,
) {
  const isProduction = import.meta.env.PROD;

  const cookieOptions = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 7, // 7 dagen
  };

  cookies.set("sb-access-token", accessToken, cookieOptions);
  cookies.set("sb-refresh-token", refreshToken, cookieOptions);
}

/**
 * Verwijder auth-cookies.
 */
export function clearAuthCookies(cookies: AstroCookies) {
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
}
