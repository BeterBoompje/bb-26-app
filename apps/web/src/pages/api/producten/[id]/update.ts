import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { id } = params;

  let body: {
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

  const updates: Record<string, unknown> = {};
  if (body.display_label !== undefined) updates.display_label = body.display_label?.trim() || null;
  if (body.product_type !== undefined) updates.product_type = body.product_type?.trim() || null;
  if (body.color_name !== undefined) updates.color_name = body.color_name?.trim() || null;
  if (body.sort_order !== undefined) updates.sort_order = parseInt(String(body.sort_order)) || 0;
  if (body.is_active !== undefined) updates.is_active = body.is_active === false || body.is_active === "false" ? false : true;

  const { error } = await auth.supabase
    .from("product_variants")
    .update(updates)
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
