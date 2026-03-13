import type { APIRoute } from "astro";
import { clearAuthCookies } from "../../../lib/supabase/server";

export const GET: APIRoute = async ({ cookies, redirect }) => {
  clearAuthCookies(cookies);
  return redirect("/signin");
};
