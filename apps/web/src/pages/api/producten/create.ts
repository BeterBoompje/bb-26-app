import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

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
    return new Response(JSON.stringify({ error: "Geen project gevonden." }), { status: 400 });
  }

  let body: {
    sku_pattern?: string;
    display_label?: string;
    product_type?: string;
    color_name?: string;
    sort_order?: string | number;
    is_active?: string | boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { sku_pattern, display_label, product_type, color_name, sort_order, is_active } = body;

  if (!sku_pattern?.trim()) {
    return new Response(JSON.stringify({ error: "sku_pattern vereist" }), { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("product_variants")
    .insert({
      project_id,
      sku_pattern: sku_pattern.trim().toUpperCase(),
      display_label: display_label?.trim() || null,
      product_type: product_type?.trim() || null,
      color_name: color_name?.trim() || null,
      sort_order: sort_order ? parseInt(String(sort_order)) : 0,
      is_active: is_active === false || is_active === "false" ? false : true,
    })
    .select("id, sku_pattern, display_label")
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? "Een product met dit SKU-patroon bestaat al voor dit project."
        : error.message;
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, product: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
