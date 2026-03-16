import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  let project_id = auth.profile!.project_id as string | null | undefined;
  if (!project_id) {
    const { data: proj } = await auth.supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    project_id = proj?.id;
  }
  if (!project_id) {
    return new Response(JSON.stringify({ error: "Geen project gevonden." }), { status: 400 });
  }

  let body: {
    name?: string;
    code?: string;
    city?: string;
    is_active?: string | boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { name, code, city, is_active } = body;

  if (!name?.trim()) {
    return new Response(JSON.stringify({ error: "name vereist" }), { status: 400 });
  }
  if (!code?.trim()) {
    return new Response(JSON.stringify({ error: "code vereist" }), { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("locations")
    .insert({
      project_id,
      name: name.trim(),
      slug: code.trim().toLowerCase(),
      code: code.trim().toLowerCase(),
      city: city?.trim() || null,
      is_active: is_active === false || is_active === "false" ? false : true,
    })
    .select("id, name, code")
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? "Een locatie met deze code bestaat al voor dit project."
        : error.message;
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, location: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
