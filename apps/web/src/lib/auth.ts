import type { AstroCookies } from "astro";
import { createServerClient, clearAuthCookies } from "./supabase/server";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

// ── Gedeelde types ────────────────────────────────────────────────────────────

export type StaffRole = "admin" | "location_manager" | "scanner" | "distributor";

/**
 * Metadata uit staff_profiles — voor display (naam, avatar, default locatie).
 * NIET gebruiken voor toegangscontrole: gebruik ProjectContext daarvoor.
 */
export type StaffProfile = {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  /** @deprecated Gebruik project.project_id — dit veld wordt uitgefaseerd. */
  project_id: string | null;
  default_location_id: string | null;
};

/**
 * Autorisatiecontext uit project_memberships.
 * Dit is de enige bron van waarheid voor projecttoegang.
 * Vervangt de staff_profiles.project_id fallback-aanpak.
 */
export type ProjectContext = {
  membership_id: string;
  project_id: string;
  role: StaffRole;
};

/** Succesvol geauthenticeerd resultaat */
export type AuthOk = {
  supabase: SupabaseClient;
  session: Session;
  profile: StaffProfile;
  project: ProjectContext;
  forbidden?: never;
};

/** Ingelogd maar geen toegang tot de gevraagde rol/resource */
export type AuthForbidden = {
  supabase: SupabaseClient;
  session: Session;
  profile: null;
  project: null;
  forbidden: true;
};

export type AuthResult = AuthOk | AuthForbidden;

// ── Interne helper ────────────────────────────────────────────────────────────

async function resolveMembership(
  supabase: SupabaseClient,
  session: Session,
  roles: StaffRole[],
): Promise<AuthResult> {
  const uid = session.user.id;

  // project_memberships is de enige bron voor projectautorisatie.
  // Geen "eerste actieve project" fallback — als er geen membership is, is dat
  // een configuratiefout en moet de admin de gebruiker expliciet toevoegen.
  const { data: membership } = await supabase
    .from("project_memberships")
    .select("id, project_id, role")
    .eq("user_id", uid)
    .eq("is_active", true)
    .in("role", roles)
    .limit(1)
    .single();

  if (!membership) {
    return { supabase, session, profile: null, project: null, forbidden: true };
  }

  // staff_profiles voor display-metadata (naam, default locatie)
  const { data: profileRow } = await supabase
    .from("staff_profiles")
    .select("id, full_name, email, role, is_active, project_id, default_location_id")
    .eq("id", uid)
    .single();

  // Fallback als staff_profiles nog niet gesynchroniseerd is
  const profile: StaffProfile = profileRow ?? {
    id: uid,
    full_name: session.user.email ?? "Onbekend",
    email: session.user.email ?? "",
    role: membership.role as StaffRole,
    is_active: true,
    project_id: membership.project_id,
    default_location_id: null,
  };

  return {
    supabase,
    session,
    profile,
    project: {
      membership_id: membership.id,
      project_id: membership.project_id,
      role: membership.role as StaffRole,
    },
  };
}

// ── Publieke auth-functies ────────────────────────────────────────────────────

/**
 * requireAdmin — vereist een actieve admin-membership.
 *
 * Geeft `null` terug als de gebruiker niet ingelogd is (redirect → /signin).
 * Geeft `{ forbidden: true }` terug als ingelogd maar geen admin (redirect → /app).
 *
 * project_id wordt ALTIJD uit project_memberships gehaald — nooit uit
 * staff_profiles.project_id en nooit via een "eerste actieve project" fallback.
 */
export async function requireAdmin(
  cookies: AstroCookies,
): Promise<AuthResult | null> {
  const { supabase, session } = await createServerClient(cookies);
  if (!session) return null;
  return resolveMembership(supabase, session, ["admin"]);
}

/**
 * requireStaff — vereist een actieve membership met een van de toegestane rollen.
 *
 * Standaard: admin, location_manager, scanner, distributor.
 * Gebruik voor scanner-flow, locatiebeheer en distributeursportaal.
 *
 * @example
 *   const auth = await requireStaff(Astro.cookies, ["scanner", "location_manager"]);
 */
export async function requireStaff(
  cookies: AstroCookies,
  allowedRoles: StaffRole[] = ["admin", "location_manager", "scanner", "distributor"],
): Promise<AuthResult | null> {
  const { supabase, session } = await createServerClient(cookies);
  if (!session) return null;
  return resolveMembership(supabase, session, allowedRoles);
}

/**
 * requireAuth — minimale check: alleen ingelogd zijn.
 *
 * Gebruik uitsluitend voor publieke-maar-sessie-vereiste routes.
 * Gebruik requireAdmin of requireStaff voor beveiligde routes.
 */
export async function requireAuth(cookies: AstroCookies) {
  const { supabase, session } = await createServerClient(cookies);
  if (!session) return null;
  return { supabase, session };
}
export { clearAuthCookies };
