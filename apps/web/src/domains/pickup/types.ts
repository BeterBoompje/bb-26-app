/**
 * Domain: Pickup
 * Verantwoordelijk voor: ophaallocaties, pickup_targets, pickup_events,
 * scanner-flow en QR-codes.
 *
 * Dit domein kent geen schrijfacties vanuit de klant —
 * alles wordt aangestuurd door Shopify-webhooks of admin-acties.
 */

export type PickupStatus =
  | "pending"
  | "ready"
  | "picked_up"
  | "blocked"
  | "cancelled";

export type Location = {
  id: string;
  project_id: string;
  name: string;
  city: string | null;
  address: string | null;
  created_at: string;
};

export type PickupTarget = {
  id: string;
  project_id: string;
  season_id: string;
  order_id: string;
  intended_location_id: string;
  pickup_status: PickupStatus;
  eligibility_status: string | null;
  created_at: string;
  updated_at: string;
};

export type PickupEvent = {
  id: string;
  pickup_target_id: string;
  event_type: string;
  performed_by: string | null;
  created_at: string;
};

export type LocationSeasonDetail = {
  id: string;
  location_id: string;
  season_id: string;
  pickup_window_1_date: string | null;
  pickup_window_1_hours: string | null;
  pickup_window_2_date: string | null;
  pickup_window_2_hours: string | null;
};

/** Gecombineerd voor de scanner-weergave */
export type PickupScanResult = {
  pickup_target: PickupTarget;
  location: Location;
  order: {
    id: string;
    shopify_order_number: string | null;
    customer_name: string | null;
    customer_email: string | null;
  };
};
