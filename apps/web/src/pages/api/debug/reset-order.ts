import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

/**
 * POST /api/debug/reset-order
 * Body: { pickup_target_id: string }
 *
 * Zet een pickup_target terug naar 'ready' voor herhaald testen.
 * Logt de actie in pickup_events (manual_override) en admin_overrides.
 * Vereist admin rol.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);

  if (!auth) {
    return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  }
  if (auth.forbidden) {
    return new Response(JSON.stringify({ error: "Geen toegang — admin vereist" }), { status: 403 });
  }

  const { supabase, session, profile } = auth;

  let body: { pickup_target_id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { pickup_target_id } = body;
  if (!pickup_target_id) {
    return new Response(JSON.stringify({ error: "pickup_target_id vereist" }), { status: 400 });
  }

  // Haal huidige status op voor de audit log
  const { data: current, error: fetchErr } = await supabase
    .from("pickup_targets")
    .select("id, pickup_status")
    .eq("id", pickup_target_id)
    .single();

  if (fetchErr || !current) {
    return new Response(JSON.stringify({ error: "Bestelling niet gevonden" }), { status: 404 });
  }

  const prevStatus = current.pickup_status;

  // 1. Reset pickup_target naar 'ready'
  const { error: updateErr } = await supabase
    .from("pickup_targets")
    .update({
      pickup_status: "ready",
      issued_at: null,
      issued_by: null,
      last_event_id: null,
      eligibility_status: null,
    })
    .eq("id", pickup_target_id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
  }

  // 2. Log in pickup_events (manual_override is een bestaande enum waarde)
  await supabase.from("pickup_events").insert({
    pickup_target_id,
    event_type: "manual_override",
    result: "success",
    staff_user_id: session.user.id,
    notes: `Debug reset via dashboard (was: ${prevStatus})`,
  });

  // 3. Log in admin_overrides voor audit trail
  if (profile?.id) {
    await supabase.from("admin_overrides").insert({
      target_type: "pickup_target",
      target_id: pickup_target_id,
      action_type: "debug_reset",
      old_value: { pickup_status: prevStatus },
      new_value: { pickup_status: "ready" },
      reason: "Debug reset via dashboard",
      performed_by: profile.id,
    });
  }

  return new Response(
    JSON.stringify({ success: true, previous_status: prevStatus, new_status: "ready" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
