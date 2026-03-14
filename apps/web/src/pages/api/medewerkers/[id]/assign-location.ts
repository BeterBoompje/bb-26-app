import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

/**
 * POST /api/medewerkers/[id]/assign-location
 * Body: { location_id, role_level: 'staff' | 'manager' }
 */
export const POST: APIRoute = async ({ request, params, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { id: user_id } = params;
  if (!user_id) return new Response(JSON.stringify({ error: "user id vereist" }), { status: 400 });

  let body: { location_id?: string; role_level?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { location_id, role_level = "staff" } = body;
  if (!location_id) return new Response(JSON.stringify({ error: "location_id vereist" }), { status: 400 });
  if (!["staff", "manager"].includes(role_level)) {
    return new Response(JSON.stringify({ error: "role_level moet 'staff' of 'manager' zijn" }), { status: 400 });
  }

  const { error } = await auth.supabase
    .from("location_assignments")
    .insert({ user_id, location_id, role_level });

  if (error) {
    const msg = error.code === "23505" ? "Medewerker is al gekoppeld aan deze locatie." : error.message;
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
