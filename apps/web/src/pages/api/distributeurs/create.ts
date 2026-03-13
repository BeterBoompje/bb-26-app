import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

/**
 * POST /api/distributeurs/create
 * Body: { name, code?, contact_name?, contact_email?, notes?, project_id }
 *
 * Maakt een nieuwe distributor aan voor het opgegeven project.
 * Vereist admin rol.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  let body: {
    project_id?: string;
    name?: string;
    code?: string;
    contact_name?: string;
    contact_email?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { project_id, name, code, contact_name, contact_email, notes } = body;

  if (!project_id) return new Response(JSON.stringify({ error: "project_id vereist" }), { status: 400 });
  if (!name?.trim()) return new Response(JSON.stringify({ error: "name vereist" }), { status: 400 });

  const { data, error } = await auth.supabase
    .from("distributors")
    .insert({
      project_id,
      name: name.trim(),
      code: code?.trim() || null,
      contact_name: contact_name?.trim() || null,
      contact_email: contact_email?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select("id, name, code")
    .single();

  if (error) {
    const msg = error.code === "23505"
      ? "Een distributor met deze code bestaat al voor dit project."
      : error.message;
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, distributor: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
