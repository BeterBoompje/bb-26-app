import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

/**
 * POST /api/medewerkers/[id]/update
 * Body: { full_name?, role?, default_location_id?, is_active? }
 */
export const POST: APIRoute = async ({ request, params, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { id } = params;
  if (!id) return new Response(JSON.stringify({ error: "id vereist" }), { status: 400 });

  let body: {
    full_name?: string;
    role?: string;
    default_location_id?: string | null;
    is_active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const validRoles = ["admin", "location_manager", "scanner", "distributor"];
  if (body.role && !validRoles.includes(body.role)) {
    return new Response(JSON.stringify({ error: "Ongeldige rol" }), { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.full_name !== undefined) patch.full_name = body.full_name.trim();
  if (body.role !== undefined) patch.role = body.role;
  if (body.default_location_id !== undefined) patch.default_location_id = body.default_location_id || null;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  if (Object.keys(patch).length === 0) {
    return new Response(JSON.stringify({ error: "Geen velden om bij te werken" }), { status: 400 });
  }

  const { error } = await auth.supabase
    .from("staff_profiles")
    .update(patch)
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
