import type { APIRoute } from "astro";
import { createServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async ({ request, cookies }) => {
  const { supabase, session } = await createServerClient(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let body: { pickup_target_id: string; location_id: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const { pickup_target_id, location_id, notes } = body;
  if (!pickup_target_id || !location_id) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
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
