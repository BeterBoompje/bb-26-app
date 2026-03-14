import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";

/**
 * POST /api/medewerkers/create
 * Body: { id, full_name, email, role, default_location_id? }
 *
 * Maakt een staff_profiles rij aan voor een bestaande Supabase Auth-user.
 * De auth-user moet vooraf aangemaakt zijn via het Supabase Dashboard.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const project_id = auth.profile!.project_id as string | null | undefined;

  let body: {
    id?: string;
    full_name?: string;
    email?: string;
    role?: string;
    default_location_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige JSON" }), { status: 400 });
  }

  const { id, full_name, email, role, default_location_id } = body;

  if (!id?.trim()) return new Response(JSON.stringify({ error: "id (UUID uit Supabase Auth) vereist" }), { status: 400 });
  if (!full_name?.trim()) return new Response(JSON.stringify({ error: "full_name vereist" }), { status: 400 });
  if (!email?.trim()) return new Response(JSON.stringify({ error: "email vereist" }), { status: 400 });
  if (!role) return new Response(JSON.stringify({ error: "role vereist" }), { status: 400 });

  const validRoles = ["admin", "location_manager", "scanner", "distributor"];
  if (!validRoles.includes(role)) {
    return new Response(JSON.stringify({ error: "Ongeldige rol" }), { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("staff_profiles")
    .insert({
      id: id.trim(),
      project_id: project_id ?? null,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      role,
      default_location_id: default_location_id?.trim() || null,
      is_active: true,
    })
    .select("id, full_name, email, role")
    .single();

  if (error) {
    const msg =
      error.code === "23505" ? "Een medewerker met dit UUID of e-mailadres bestaat al." :
      error.code === "23503" ? "Onbekende UUID — controleer of de user bestaat in Supabase Auth." :
      error.message;
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, medewerker: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
