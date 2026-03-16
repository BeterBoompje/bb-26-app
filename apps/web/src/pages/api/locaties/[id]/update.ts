import type { APIRoute } from "astro";
import { requireAdmin } from "../../../../lib/auth";

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const { id } = params;

  let body: {
    name?: string;
    city?: string;
    is_active?: string | boolean;
    is_open?: string | boolean;
    is_sold_out?: string | boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name?.trim() || null;
  if (body.city !== undefined) updates.city = body.city?.trim() || null;
  if (body.is_active !== undefined) updates.is_active = body.is_active === false || body.is_active === "false" ? false : true;
  if (body.is_open !== undefined) updates.is_open = body.is_open === false || body.is_open === "false" ? false : true;
  if (body.is_sold_out !== undefined) updates.is_sold_out = body.is_sold_out === true || body.is_sold_out === "true" ? true : false;

  const { error } = await auth.supabase
    .from("locations")
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
