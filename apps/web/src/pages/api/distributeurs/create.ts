import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

/**
 * POST /api/distributeurs/create
 * Body: { name, code?, contact_name?, contact_email?, notes? }
 *
 * project_id wordt server-side opgezocht via de ingelogde admin —
 * de client hoeft dat nooit te sturen (veiliger + simpler).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  // project_id zit in het profile object (zie auth.ts).
  // Fallback: als het null is, pak het eerste actieve project (BB heeft er maar één).
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
    return new Response(
      JSON.stringify({ error: "Geen project gevonden. Controleer de database-configuratie." }),
      { status: 400 }
    );
  }

  let body: {
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

  const { name, code, contact_name, contact_email, notes } = body;

  if (!name?.trim()) {
    return new Response(JSON.stringify({ error: "name vereist" }), { status: 400 });
  }

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
    const msg =
      error.code === "23505"
        ? "Een distributor met deze code bestaat al voor dit project."
        : error.message;
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, distributor: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
