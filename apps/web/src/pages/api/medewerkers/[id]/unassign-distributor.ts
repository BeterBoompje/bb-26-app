import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

/**
 * DELETE /api/medewerkers/[id]/unassign-distributor
 * Body: { distributor_id }
 */
export const DELETE: APIRoute = async ({ request, params, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { id: user_id } = params;
  if (!user_id) return new Response(JSON.stringify({ error: "user id vereist" }), { status: 400 });

  let body: { distributor_id?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { distributor_id } = body;
  if (!distributor_id) return new Response(JSON.stringify({ error: "distributor_id vereist" }), { status: 400 });

  const { error } = await auth.supabase
    .from("distributor_assignments")
    .delete()
    .eq("user_id", user_id)
    .eq("distributor_id", distributor_id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
