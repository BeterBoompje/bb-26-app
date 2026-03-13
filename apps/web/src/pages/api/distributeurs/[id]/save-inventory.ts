import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

/**
 * POST /api/distributeurs/[id]/save-inventory
 * Body: {
 *   season_id: string,
 *   lines: Array<{
 *     id?: string,            // bestaande rij (update) of ontbreekt (insert)
 *     category_code: string,
 *     display_label?: string,
 *     voorraad: number,
 *     ingekocht: number,
 *     notes?: string,
 *     sort_order?: number,
 *   }>
 * }
 *
 * Slaat alle inventory_lines op via upsert.
 * Vereist admin rol.
 */
export const POST: APIRoute = async ({ request, params, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const distributor_id = params.id;
  if (!distributor_id) return new Response(JSON.stringify({ error: "id vereist" }), { status: 400 });

  let body: { season_id?: string; lines?: any[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { season_id, lines } = body;
  if (!season_id) return new Response(JSON.stringify({ error: "season_id vereist" }), { status: 400 });
  if (!Array.isArray(lines) || lines.length === 0) {
    return new Response(JSON.stringify({ error: "lines vereist (array)" }), { status: 400 });
  }

  // Valideer dat distributor bij deze admin's project hoort
  const { data: dist, error: distErr } = await auth.supabase
    .from("distributors")
    .select("id")
    .eq("id", distributor_id)
    .single();

  if (distErr || !dist) {
    return new Response(JSON.stringify({ error: "Distributor niet gevonden" }), { status: 404 });
  }

  // Bouw upsert-payload
  const rows = lines.map((l: any, i: number) => ({
    ...(l.id ? { id: l.id } : {}),
    distributor_id,
    season_id,
    category_code: (l.category_code ?? "").trim(),
    display_label: l.display_label?.trim() || null,
    voorraad: Number(l.voorraad ?? 0),
    ingekocht: Number(l.ingekocht ?? 0),
    notes: l.notes?.trim() || null,
    sort_order: l.sort_order ?? i,
  }));

  const { data, error } = await auth.supabase
    .from("inventory_lines")
    .upsert(rows, { onConflict: "distributor_id,season_id,category_code" })
    .select("id, category_code");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, saved: data?.length ?? 0 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
