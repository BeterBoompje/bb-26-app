/**
 * Domain: Access
 * Verantwoordelijk voor: authenticatie, rollen, projecttoegang,
 * medewerkersbeheer, locatie- en distributeursassignments.
 *
 * Autorisatiebron: project_memberships (niet staff_profiles.project_id)
 */

export type StaffRole = "admin" | "location_manager" | "scanner" | "distributor";

export type ProjectMembership = {
  id: string;
  user_id: string;
  project_id: string;
  role: StaffRole;
  default_location_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffProfile = {
  id: string;
  /** @deprecated Gebruik project_memberships voor autorisatie */
  project_id: string | null;
  default_location_id: string | null;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LocationAssignment = {
  id: string;
  user_id: string;
  location_id: string;
  role_level: "staff" | "manager";
  created_at: string;
};

export type DistributorAssignment = {
  id: string;
  user_id: string;
  distributor_id: string;
  role_level: "staff" | "manager";
  created_at: string;
};
