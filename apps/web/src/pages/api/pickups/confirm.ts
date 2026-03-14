import type { APIRoute } from "astro";
import { requireStaff } from "../../../lib/auth";
import { parseBody, jsonError, UNAUTHORIZED, FORBIDDEN } from "../../../lib/api-helpers";

export const POST: APIRoute = async ({ request, cookies }) => {
  // Bevestiging vereist actieve staff-membership (scanner of hoger)
  const auth = await requireStaff(cookies, ["admin", "location_manager", "scanner"]);
  if (!auth) return UNAUTHORIZED();
  if (auth.forbidden) return FORBIDDEN();

  const { supabase, session } = auth;

  const parsed = await parseBody<{
    pickup_target_id: string;
    location_id: string;
    notes?: string;
  }>(request);
  if (parsed.error) return parsed.error;

  const { pickup_target_id, location_id, notes } = parsed.data;
  if (!pickup_target_id || !location_id) {
    return jsonError("pickup_target_id en location_id zijn verplicht");
  }

  const { data, error } = await supabase.rpc("confirm_pickup", {
    p_pickup_target_id: pickup_target_id,
    p_staff_user_id: session.user.id,
    p_location_id: location_id,
    p_notes: notes ?? null,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "confirm_failed", detail: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, pickup_target: data }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
