import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

/**
 * POST /api/distributeurs/[id]/add-adjustment
 * Body: {
 *   inventory_line_id: string,
 *   label: string,       -- bijv. "INFLUENCER ACTIE", "EXTRA GOUDA"
 *   quantity: number,    -- positief = ontvangen, negatief = uitgegeven
 *   notes?: string,
 * }
 *
 * Voegt een immutable aanpassing toe aan een inventory_line.
 * Vereist admin rol.
 */
export const POST: APIRoute = async ({ request, params, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const distributor_id = params.id;
  if (!distributor_id) return new Response(JSON.stringify({ error: "id vereist" }), { status: 400 });

  let body: { inventory_line_id?: string; label?: string; quantity?: number; notes?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { inventory_line_id, label, quantity, notes } = body;

  if (!inventory_line_id) return new Response(JSON.stringify({ error: "inventory_line_id vereist" }), { status: 400 });
  if (!label?.trim()) return new Response(JSON.stringify({ error: "label vereist" }), { status: 400 });
  if (quantity === undefined || quantity === null || isNaN(Number(quantity))) {
    return new Response(JSON.stringify({ error: "quantity vereist (getal)" }), { status: 400 });
  }

  // Controleer dat de inventory_line bij deze distributor hoort
  const { data: line, error: lineErr } = await auth.supabase
    .from("inventory_lines")
    .select("id")
    .eq("id", inventory_line_id)
    .eq("distributor_id", distributor_id)
    .single();

  if (lineErr || !line) {
    return new Response(JSON.stringify({ error: "Voorraadregel niet gevonden" }), { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from("inventory_adjustments")
    .insert({
      inventory_line_id,
      label: label.trim().toUpperCase(),
      quantity: Number(quantity),
      notes: notes?.trim() || null,
    })
    .select("id, label, quantity")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, adjustment: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
