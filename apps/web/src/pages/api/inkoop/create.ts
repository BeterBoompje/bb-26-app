import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

/**
 * POST /api/inkoop/create
 * Body: {
 *   doel, leverancier, levering_week?, status?,
 *   categorie_code, product_code?, product_naam?, label_kleur?, bb_wensen?, sku?,
 *   bestemming?, leverings_locatie?,
 *   inkoop_excl?, fulfillment_excl?, verzend_excl?, afdracht_excl?,
 *   green_return?, handelsprijs?, verkoop_incl?, verkoop_excl?,
 *   aantal, opmerkingen?, season_id?
 * }
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { supabase, profile } = auth;
  let project_id = profile!.project_id as string | null | undefined;
  if (!project_id) {
    const { data: proj } = await supabase
      .from("projects").select("id").eq("is_active", true).limit(1).single();
    project_id = proj?.id;
  }
  if (!project_id) {
    return new Response(JSON.stringify({ error: "Geen project gevonden" }), { status: 400 });
  }

  // Actief seizoen ophalen als season_id niet meegegeven
  let body: Record<string, any>;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 }); }

  let season_id = body.season_id;
  if (!season_id) {
    const { data: season } = await supabase
      .from("seasons").select("id").eq("project_id", project_id).eq("is_active", true).limit(1).single();
    season_id = season?.id;
  }
  if (!season_id) {
    return new Response(JSON.stringify({ error: "Geen actief seizoen gevonden" }), { status: 400 });
  }

  if (!body.doel?.trim()) {
    return new Response(JSON.stringify({ error: "doel vereist" }), { status: 400 });
  }
  if (!body.categorie_code?.trim()) {
    return new Response(JSON.stringify({ error: "categorie_code vereist" }), { status: 400 });
  }

  const num = (v: any) => (v !== undefined && v !== "" ? Number(v) : null);

  const { data, error } = await supabase
    .from("purchase_order_lines")
    .insert({
      project_id,
      season_id,
      doel:              body.doel.trim(),
      leverancier:       body.leverancier?.trim() ?? "",
      levering_week:     body.levering_week?.trim() || null,
      status:            body.status ?? "optie",
      categorie_code:    body.categorie_code.trim(),
      product_code:      body.product_code?.trim() || null,
      product_naam:      body.product_naam?.trim() || null,
      label_kleur:       body.label_kleur?.trim() || null,
      bb_wensen:         body.bb_wensen?.trim() || null,
      sku:               body.sku?.trim() || null,
      bestemming:        body.bestemming?.trim() || null,
      leverings_locatie: body.leverings_locatie?.trim() || null,
      inkoop_excl:       num(body.inkoop_excl),
      fulfillment_excl:  num(body.fulfillment_excl),
      verzend_excl:      num(body.verzend_excl),
      afdracht_excl:     num(body.afdracht_excl),
      green_return:      num(body.green_return),
      handelsprijs:      num(body.handelsprijs),
      verkoop_incl:      num(body.verkoop_incl),
      verkoop_excl:      num(body.verkoop_excl),
      aantal:            Number(body.aantal ?? 0),
      opmerkingen:       body.opmerkingen?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, line: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
