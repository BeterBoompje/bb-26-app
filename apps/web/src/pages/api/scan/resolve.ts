import type { APIRoute } from "astro";
import { createServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async ({ request, cookies }) => {
  const { supabase, session } = await createServerClient(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let body: { qr_value: string; location_id: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const { qr_value, location_id } = body;
  if (!qr_value || !location_id) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }

  // Look up pickup target met order + klantinfo
  const { data: target } = await supabase
    .from("pickup_targets")
    .select(`
      id,
      qr_value,
      pickup_status,
      payment_status,
      intended_location_id,
      order_id,
      shopify_orders (
        shopify_name,
        shopify_customers (
          first_name,
          last_name,
          email
        )
      )
    `)
    .eq("qr_value", qr_value)
    .single();

  if (!target) {
    return new Response(
      JSON.stringify({ eligibility: "not_found", reason: "qr_not_found", pickup_target: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check eligibility via RPC
  const { data: eligibility } = await supabase
    .rpc("resolve_pickup_eligibility", {
      p_pickup_target_id: target.id,
      p_location_id: location_id,
    })
    .single();

  return new Response(
    JSON.stringify({
      eligibility: eligibility?.eligibility ?? "manual_review",
      reason: eligibility?.reason ?? "unknown",
      pickup_target: target,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
