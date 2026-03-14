import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";
import { createAdminClient } from "../../../lib/supabase/admin";

const ALLOWED_STATUSES = ["ready", "blocked", "picked_up", "reversed", "expired"] as const;
type PickupStatus = typeof ALLOWED_STATUSES[number];

/**
 * POST /api/debug/set-status
 * Body: { pickup_target_id: string, status: PickupStatus }
 *
 * Zet de pickup_status op een willekeurige testwaarde.
 * Simuleert verschillende scenario's voor de scanner:
 *   ready        → normaal, scanbaar
 *   blocked      → geblokkeerd
 *   picked_up    → al opgehaald (scanner toont "Al afgehaald")
 *   reversed     → afgehaald maar teruggedraaid
 *   expired      → verlopen window
 *
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

  const { session, profile } = auth;

  // Gebruik admin client (service role) om RLS te omzeilen voor debug-operaties.
  // Auth is al geverifieerd via requireAdmin hierboven.
  let adminDb: ReturnType<typeof createAdminClient>;
  try {
    adminDb = createAdminClient();
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }

  let body: { pickup_target_id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { pickup_target_id, status } = body;

  if (!pickup_target_id) {
    return new Response(JSON.stringify({ error: "pickup_target_id vereist" }), { status: 400 });
  }

  if (!status || !ALLOWED_STATUSES.includes(status as PickupStatus)) {
    return new Response(
      JSON.stringify({ error: `Ongeldige status. Toegestaan: ${ALLOWED_STATUSES.join(", ")}` }),
      { status: 400 }
    );
  }

  // Haal huidige status op
  const { data: current, error: fetchErr } = await adminDb
    .from("pickup_targets")
    .select("id, pickup_status")
    .eq("id", pickup_target_id)
    .single();

  if (fetchErr || !current) {
    return new Response(JSON.stringify({ error: "Bestelling niet gevonden" }), { status: 404 });
  }

  const prevStatus = current.pickup_status;

  // Update status
  const updatePayload: Record<string, unknown> = { pickup_status: status };

  // Bij picked_up: zet issued_at voor volledigheid
  if (status === "picked_up") {
    updatePayload.issued_at = new Date().toISOString();
    updatePayload.issued_by = session.user.id;
  }

  // Bij reset naar ready: wis issued velden (eligibility_status NOT NULL, dus niet aanraken)
  if (status === "ready") {
    updatePayload.issued_at = null;
    updatePayload.issued_by = null;
    updatePayload.last_event_id = null;
  }

  const { error: updateErr } = await adminDb
    .from("pickup_targets")
    .update(updatePayload)
    .eq("id", pickup_target_id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
  }

  // Log in pickup_events
  await adminDb.from("pickup_events").insert({
    pickup_target_id,
    event_type: "manual_override",
    result: "success",
    staff_user_id: session.user.id,
    notes: `Debug status wijziging: ${prevStatus} → ${status}`,
  });

  // Log in admin_overrides
  if (profile?.id) {
    await adminDb.from("admin_overrides").insert({
      target_type: "pickup_target",
      target_id: pickup_target_id,
      action_type: "debug_set_status",
      old_value: { pickup_status: prevStatus },
      new_value: { pickup_status: status },
      reason: "Debug status override via dashboard",
      performed_by: profile.id,
    });
  }

  return new Response(
    JSON.stringify({ success: true, previous_status: prevStatus, new_status: status }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
