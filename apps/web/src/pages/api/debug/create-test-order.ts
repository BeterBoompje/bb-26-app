import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

const TEST_QR_VALUE = "TEST-QR-001";

/**
 * POST /api/debug/create-test-order
 *
 * Reset de herbruikbare testbestelling (qr_value = 'TEST-QR-001') naar 'ready'.
 * De testdata moet éénmalig worden aangemaakt via supabase/test-data.sql.
 *
 * Vereist admin rol.
 */
export const POST: APIRoute = async ({ cookies }) => {
  const auth = await requireAdmin(cookies);

  if (!auth) {
    return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  }
  if (auth.forbidden) {
    return new Response(JSON.stringify({ error: "Geen toegang — admin vereist" }), { status: 403 });
  }

  const { supabase, session } = auth;

  // Zoek testbestelling op qr_value
  const { data: target, error: fetchErr } = await supabase
    .from("pickup_targets")
    .select("id, pickup_status, qr_value, shopify_orders(shopify_name)")
    .eq("qr_value", TEST_QR_VALUE)
    .single();

  if (fetchErr || !target) {
    return new Response(
      JSON.stringify({
        error: "Testbestelling niet gevonden.",
        hint: "Voer eerst supabase/test-data.sql uit in de Supabase SQL Editor om de testdata aan te maken.",
        sql_path: "apps/web/supabase/test-data.sql",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const prevStatus = target.pickup_status;

  // Reset naar 'ready'
  const { error: updateErr } = await supabase
    .from("pickup_targets")
    .update({
      pickup_status: "ready",
      issued_at: null,
      issued_by: null,
      last_event_id: null,
      eligibility_status: null,
    })
    .eq("id", target.id);

  if (updateErr) {
    return new Response(
      JSON.stringify({ error: updateErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Log reset in pickup_events
  await supabase.from("pickup_events").insert({
    pickup_target_id: target.id,
    event_type: "manual_override",
    result: "success",
    staff_user_id: session.user.id,
    notes: `Testbestelling gereset via dashboard (was: ${prevStatus})`,
  });

  const order = target.shopify_orders as any;

  return new Response(
    JSON.stringify({
      action: "reset",
      pickup_target_id: target.id,
      qr_value: TEST_QR_VALUE,
      order_name: order?.shopify_name ?? "#TEST-001",
      previous_status: prevStatus,
      message: `Testbestelling gereset naar 'ready'. Scan QR-waarde: ${TEST_QR_VALUE}`,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
