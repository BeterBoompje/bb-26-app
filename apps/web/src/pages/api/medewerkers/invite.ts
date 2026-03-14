import type { APIRoute } from "astro";
import { requireAdmin } from "../../../lib/auth";
import { createAdminClient } from "../../../lib/supabase/admin";

/**
 * POST /api/medewerkers/invite
 * Body: { full_name, email, role, default_location_id? }
 *
 * Maakt een Supabase Auth-user aan via admin API en stuurt een uitnodigingsmail.
 * Daarna wordt direct een staff_profiles rij aangemaakt.
 * Admin hoeft NIET in te loggen op Supabase Dashboard.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(cookies);
  if (!auth) return new Response(JSON.stringify({ error: "Niet ingelogd" }), { status: 401 });
  if (auth.forbidden) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403 });

  const project_id = auth.profile!.project_id as string | null | undefined;

  let body: {
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

  const { full_name, email, role, default_location_id } = body;

  if (!full_name?.trim()) return new Response(JSON.stringify({ error: "full_name vereist" }), { status: 400 });
  if (!email?.trim()) return new Response(JSON.stringify({ error: "email vereist" }), { status: 400 });
  if (!role) return new Response(JSON.stringify({ error: "role vereist" }), { status: 400 });

  const validRoles = ["admin", "location_manager", "scanner", "distributor"];
  if (!validRoles.includes(role)) {
    return new Response(JSON.stringify({ error: "Ongeldige rol" }), { status: 400 });
  }

  const adminClient = createAdminClient();

  // 1. Supabase Auth user aanmaken via invite (stuurt magic link per e-mail)
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    {
      data: {
        full_name: full_name.trim(),
        role,
      },
    }
  );

  if (inviteError || !inviteData?.user) {
    const msg =
      inviteError?.message?.includes("already been registered")
        ? "Dit e-mailadres is al geregistreerd. Gebruik 'Medewerker toevoegen op UUID' als het account al bestaat."
        : inviteError?.message ?? "Uitnodiging mislukt.";
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  const newUserId = inviteData.user.id;

  // 2. staff_profiles rij aanmaken (via admin client om RLS te omzeilen)
  const { error: profileError } = await adminClient
    .from("staff_profiles")
    .insert({
      id: newUserId,
      project_id: project_id ?? null,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      role,
      default_location_id: default_location_id?.trim() || null,
      is_active: true,
    });

  if (profileError) {
    // Auth user is al aangemaakt — probeer te verwijderen als profiel mislukt
    await adminClient.auth.admin.deleteUser(newUserId);
    return new Response(
      JSON.stringify({ error: "Profiel aanmaken mislukt: " + profileError.message }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      medewerker: { id: newUserId, full_name: full_name.trim(), email: email.trim().toLowerCase(), role },
      message: "Uitnodigingsmail verstuurd naar " + email + ".",
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
