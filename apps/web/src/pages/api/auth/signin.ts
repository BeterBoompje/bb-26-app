import type { APIRoute } from "astro";
import type { Provider } from "@supabase/supabase-js";
import { createSupabaseClient } from "../../../lib/supabase/client";
import { setAuthCookies } from "../../../lib/supabase/server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const provider = formData.get("provider")?.toString();

  const supabase = createSupabaseClient();

  const validProviders = ["google", "github", "discord"];

  if (provider && validProviders.includes(provider)) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: `${new URL(request.url).origin}/api/auth/callback`,
      },
    });

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    return redirect(data.url);
  }

  if (!email || !password) {
    return new Response("Email and password are required", { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
  return redirect("/app");
};
