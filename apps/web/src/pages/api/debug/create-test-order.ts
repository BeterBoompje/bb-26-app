import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

const TEST_QR_VALUE   = "TEST-QR-001";
const TEST_ORDER_NAME = "#TEST-001";
const TEST_EMAIL      = "test@beterboompje.nl";

/**
 * POST /api/debug/create-test-order
 *
 * Maakt een herbruikbare testbestelling aan als die nog niet bestaat,
 * of reset hem naar 'ready' als hij al bestaat.
 *
 * Geeft altijd de pickup_target terug zodat de scanner direct getest kan worden.
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

  // Haal project_id op uit de eerste actieve locatie (vereist voor alle inserts)
  const { data: locationData } = await supabase
    .from("locations")
    .select("id, project_id")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!locationData) {
    return new Response(
      JSON.stringify({ error: "Geen actieve locatie gevonden. Voeg eerst een locatie toe." }),
      { status: 400 }
    );
  }

  const { id: locationId, project_id: projectId } = locationData;

  // ── Check of testbestelling al bestaat ──────────────────
  const { data: existingTarget } = await supabase
    .from("pickup_targets")
    .select("id, pickup_status, shopify_orders(shopify_name)")
    .eq("qr_value", TEST_QR_VALUE)
    .single();

  if (existingTarget) {
    // Al aanwezig → reset naar 'ready'
    await supabase
      .from("pickup_targets")
      .update({
        pickup_status: "ready",
        issued_at: null,
        issued_by: null,
        last_event_id: null,
        eligibility_status: null,
      })
      .eq("id", existingTarget.id);

    await supabase.from("pickup_events").insert({
      pickup_target_id: existingTarget.id,
      event_type: "manual_override",
      result: "success",
      staff_user_id: session.user.id,
      notes: "Testbestelling gereset via dashboard",
    });

    return new Response(
      JSON.stringify({
        action: "reset",
        pickup_target_id: existingTarget.id,
        qr_value: TEST_QR_VALUE,
        message: "Testbestelling gereset naar 'ready'.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Nieuwe testbestelling aanmaken ───────────────────────

  // 1. Testklant
  let customerId: string;
  const { data: existingCustomer } = await supabase
    .from("shopify_customers")
    .select("id")
    .eq("email", TEST_EMAIL)
    .eq("project_id", projectId)
    .single();

  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    const { data: newCustomer, error: custErr } = await supabase
      .from("shopify_customers")
      .insert({
        project_id: projectId,
        shopify_customer_id: "TEST-CUSTOMER-001",
        email: TEST_EMAIL,
        first_name: "Test",
        last_name: "Persoon",
        phone: "+31612345678",
      })
      .select("id")
      .single();

    if (custErr || !newCustomer) {
      return new Response(JSON.stringify({ error: "Kon testklant niet aanmaken: " + custErr?.message }), { status: 500 });
    }
    customerId = newCustomer.id;
  }

  // 2. Testbestelling
  const { data: newOrder, error: orderErr } = await supabase
    .from("shopify_orders")
    .insert({
      project_id: projectId,
      customer_id: customerId,
      shopify_order_id: "TEST-ORDER-001",
      shopify_order_number: 9999,
      shopify_name: TEST_ORDER_NAME,
      financial_status: "paid",
      fulfillment_status: null,
    })
    .select("id")
    .single();

  if (orderErr || !newOrder) {
    return new Response(JSON.stringify({ error: "Kon testbestelling niet aanmaken: " + orderErr?.message }), { status: 500 });
  }

  // 3. Testartikel
  await supabase.from("shopify_order_items").insert({
    order_id: newOrder.id,
    shopify_line_item_id: "TEST-ITEM-001",
    sku: "TEST-BOOM-001",
    title: "Testboom",
    variant_title: "150cm / Met kluit / Groen",
    quantity: 1,
    fulfillable_quantity: 1,
    product_type: "tree",
    requires_shipping: false,
  });

  // 4. Pickup target met testbare QR-waarde
  const { data: newTarget, error: targetErr } = await supabase
    .from("pickup_targets")
    .insert({
      project_id: projectId,
      order_id: newOrder.id,
      target_type: "order",
      qr_value: TEST_QR_VALUE,
      intended_location_id: locationId,
      pickup_status: "ready",
      payment_status: "paid",
    })
    .select("id")
    .single();

  if (targetErr || !newTarget) {
    return new Response(JSON.stringify({ error: "Kon pickup target niet aanmaken: " + targetErr?.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      action: "created",
      pickup_target_id: newTarget.id,
      qr_value: TEST_QR_VALUE,
      order_name: TEST_ORDER_NAME,
      message: "Testbestelling aangemaakt en klaar om te scannen.",
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
