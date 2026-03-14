import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

/**
 * PATCH /api/inkoop/[id]/update
 * Body: velden die bijgewerkt moeten worden (alle optioneel)
 */
export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { supabase, profile } = auth;
  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: "id vereist" }), { status: 400 });

  const project_id = profile!.project_id as string | null | undefined;

  let body: Record<string, any>;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 }); }

  const num = (v: any) => (v !== undefined && v !== "" && v !== null ? Number(v) : null);

  const patch: Record<string, any> = {};
  const fields = [
    "doel", "leverancier", "levering_week", "status",
    "categorie_code", "product_code", "product_naam", "label_kleur", "bb_wensen", "sku",
    "bestemming", "leverings_locatie", "opmerkingen",
  ];
  const numFields = [
    "inkoop_excl", "fulfillment_excl", "verzend_excl", "afdracht_excl",
    "green_return", "handelsprijs", "verkoop_incl", "verkoop_excl",
  ];

  for (const f of fields) {
    if (f in body) patch[f] = body[f]?.trim?.() ?? body[f] ?? null;
  }
  for (const f of numFields) {
    if (f in body) patch[f] = num(body[f]);
  }
  if ("aantal" in body) patch.aantal = Number(body.aantal ?? 0);

  if (Object.keys(patch).length === 0) {
    return new Response(JSON.stringify({ error: "Geen velden om bij te werken" }), { status: 400 });
  }

  // Bouw query — RLS zorgt dat admin alleen zijn eigen project-regels kan wijzigen
  // Supabase builder is immutable: elke .eq() geeft een nieuw object terug
  let q = supabase
    .from("purchase_order_lines")
    .update(patch)
    .eq("id", id);

  if (project_id) q = q.eq("project_id", project_id) as typeof q;

  const { data, error } = await q.select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  if (!data) {
    return new Response(JSON.stringify({ error: "Niet gevonden of geen toegang" }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true, line: data }), {
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * DELETE /api/inkoop/[id]/update
 * Verwijder een inkooporder-regel
 */
export const DELETE: APIRoute = async ({ cookies, params }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { supabase, profile } = auth;
  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: "id vereist" }), { status: 400 });

  const project_id = profile!.project_id as string | null | undefined;

  let dq = supabase
    .from("purchase_order_lines")
    .delete()
    .eq("id", id);

  if (project_id) dq = dq.eq("project_id", project_id) as typeof dq;

  const { error } = await dq;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
