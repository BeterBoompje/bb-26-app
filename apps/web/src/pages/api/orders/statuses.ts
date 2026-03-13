import type { APIRoute } from "astro";
import { requireStaff } from "../../../lib/auth";

/**
 * GET /api/orders/statuses?ids=id1,id2,...
 *
 * Lichtgewicht endpoint voor live-polling van pickup_status per order.
 * Geeft { [pickup_target_id]: pickup_status } terug.
 * Vereist staff rol (admin of locatiebeheerder).
 */
export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireStaff(cookies);
  if (!auth) return new Response(null, { status: 401 });
  if (auth.forbidden) return new Response(null, { status: 403 });

  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data } = await auth.supabase
    .from("pickup_targets")
    .select("id, pickup_status")
    .in("id", ids);

  const result = Object.fromEntries(
    (data ?? []).map((r) => [r.id, r.pickup_status])
  );

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
