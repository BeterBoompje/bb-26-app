import type { APIRoute } from "astro";
import { requireStaff } from "../../../lib/auth";
import { parseBody, jsonError, UNAUTHORIZED, FORBIDDEN } from "../../../lib/api-helpers";

export const POST: APIRoute = async ({ request, cookies }) => {
  // Vereist actieve staff-membership — aanmelden als "ingelogd zijn" is niet genoeg
  const auth = await requireStaff(cookies);
  if (!auth) return UNAUTHORIZED();
  if (auth.forbidden) return FORBIDDEN();

  const { supabase } = auth;

  const parsed = await parseBody<{ qr_value: string; location_id: string }>(request);
  if (parsed.error) return parsed.error;

  const { qr_value, location_id } = parsed.data;
  if (!qr_value || !location_id) {
    return jsonError("qr_value en location_id zijn verplicht");
  }

  // Zoek pickup target met order + klantinfo
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

  // Eligibility via RPC (bevat alle business rules in SQL)
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
