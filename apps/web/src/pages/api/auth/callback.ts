import type { APIRoute } from "astro";
import { createSupabaseClient } from "../../../lib/supabase/client";
import { setAuthCookies } from "../../../lib/supabase/server";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const authCode = url.searchParams.get("code");

  if (!authCode) {
    return new Response("No code provided", { status: 400 });
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
  return redirect("/app");
};
