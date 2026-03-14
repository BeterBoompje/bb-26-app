import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

/**
 * GET /api/rapportage/export-csv?season_id=...
 *
 * Exporteert het totaaloverzicht per boomtype als CSV.
 * Backward compatible met het Google Sheets / teller-2000.js workflow.
 * Vereist admin rol.
 */
export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(null, { status: 401 });
  if (auth.forbidden) return new Response(null, { status: 403 });

  const url = new URL(request.url);
  const season_id = url.searchParams.get("season_id");
  if (!season_id) {
    return new Response(JSON.stringify({ error: "season_id vereist" }), { status: 400 });
  }

  // Haal inventory_lines op per categorie, gesommeerd over alle distributeurs
  const { data: lines, error: linesErr } = await auth.supabase
    .from("inventory_lines")
    .select(`
      category_code,
      display_label,
      voorraad,
      ingekocht,
      inventory_adjustments ( quantity )
    `)
    .eq("season_id", season_id)
    .order("category_code");

  if (linesErr) {
    return new Response(JSON.stringify({ error: linesErr.message }), { status: 500 });
  }

  // Haal verkochte aantallen op (via shopify_order_items als die beschikbaar zijn)
  // Per category_code: match op sku LIKE category_code + '%'
  // Voor nu: query per code via in-memory join
  const { data: soldItems } = await auth.supabase
    .from("shopify_order_items")
    .select("sku, quantity, shopify_orders!inner(season_id, cancelled_at)")
    .eq("shopify_orders.season_id", season_id)
    .is("shopify_orders.cancelled_at", null);

  // Aggregeer per category_code
  type Row = {
    category_code: string;
    display_label: string | null;
    voorraad: number;
    ingekocht: number;
    extra: number;
    beschikbaar: number;
    verkocht: number;
    restant: number;
  };

  const grouped: Record<string, Row> = {};

  for (const line of lines ?? []) {
    const code = line.category_code;
    const extra = (line.inventory_adjustments as any[])?.reduce((s: number, a: any) => s + (a.quantity ?? 0), 0) ?? 0;

    if (!grouped[code]) {
      grouped[code] = {
        category_code: code,
        display_label: line.display_label ?? null,
        voorraad: 0,
        ingekocht: 0,
        extra: 0,
        beschikbaar: 0,
        verkocht: 0,
        restant: 0,
      };
    }
    grouped[code].voorraad += line.voorraad;
    grouped[code].ingekocht += line.ingekocht;
    grouped[code].extra += extra;
  }

  // Tel verkocht per category_code (SKU begint met category_code)
  for (const item of soldItems ?? []) {
    const sku = item.sku ?? "";
    for (const code of Object.keys(grouped)) {
      if (sku.startsWith(code)) {
        grouped[code].verkocht += item.quantity ?? 0;
        break;
      }
    }
  }

  // Bereken beschikbaar + restant
  for (const row of Object.values(grouped)) {
    row.beschikbaar = row.voorraad + row.ingekocht + row.extra;
    row.restant = row.beschikbaar - row.verkocht;
  }

  const rows = Object.values(grouped).sort((a, b) =>
    a.category_code.localeCompare(b.category_code)
  );

  // Genereer CSV
  const header = ["Categorie", "Omschrijving", "Voorraad", "Ingekocht", "Extra", "Beschikbaar", "Verkocht", "Restant"];
  const csvRows = [
    header.join(";"),
    ...rows.map((r) =>
      [
        r.category_code,
        r.display_label ?? "",
        r.voorraad,
        r.ingekocht,
        r.extra,
        r.beschikbaar,
        r.verkocht,
        r.restant,
      ].join(";")
    ),
  ];

  const csv = csvRows.join("\n");
  const filename = `rapportage-${season_id}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
