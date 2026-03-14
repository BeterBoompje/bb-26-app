/**
 * Domain: Supply
 * Verantwoordelijk voor: distributeurs, voorraad (inventory_lines +
 * inventory_adjustments), product-categorieën (product_variants),
 * en inkooporders (purchase_order_lines).
 *
 * Functioneel: alles wat te maken heeft met de fysieke boomplanning,
 * van inkoop bij leverancier tot voorraadbeheer bij distributeur.
 */

export type Distributor = {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
};

export type ProductVariant = {
  id: string;
  project_id: string;
  sku_pattern: string;
  display_label: string;
  color_hex: string | null;
  color_name: string | null;
  has_rootball: boolean;
  size_from_cm: number | null;
  size_to_cm: number | null;
  sort_order: number;
};

export type InventoryLine = {
  id: string;
  project_id: string;
  season_id: string;
  distributor_id: string;
  category_code: string;
  display_label: string | null;
  voorraad: number;
  ingekocht: number;
  created_at: string;
  updated_at: string;
};

export type InventoryAdjustment = {
  id: string;
  inventory_line_id: string;
  quantity: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export type InkoopStatus = "optie" | "besteld" | "geleverd" | "geannuleerd";

export type PurchaseOrderLine = {
  id: string;
  project_id: string;
  season_id: string;
  doel: string;
  leverancier: string;
  levering_week: string | null;
  status: InkoopStatus;
  categorie_code: string;
  product_code: string | null;
  product_naam: string | null;
  label_kleur: string | null;
  bb_wensen: string | null;
  sku: string | null;
  bestemming: string | null;
  leverings_locatie: string | null;
  inkoop_excl: number | null;
  fulfillment_excl: number | null;
  verzend_excl: number | null;
  afdracht_excl: number | null;
  green_return: number | null;
  handelsprijs: number | null;
  verkoop_incl: number | null;
  verkoop_excl: number | null;
  aantal: number;
  opmerkingen: string | null;
  created_at: string;
  updated_at: string;
};

/** Berekende velden voor rapportage (niet opgeslagen in DB) */
export type PurchaseOrderLineComputed = PurchaseOrderLine & {
  kostprijs: number;
  marge_per_stuk: number;
  totale_inkoop: number;
  totale_marge: number;
};

/** Bereken kostprijs en marge voor een inkooporder-regel */
export function computeOrderLine(line: PurchaseOrderLine): PurchaseOrderLineComputed {
  const inkoop   = line.inkoop_excl   ?? 0;
  const ff       = line.fulfillment_excl ?? 0;
  const verzend  = line.verzend_excl  ?? 0;
  const afdracht = line.afdracht_excl ?? 0;
  const green    = line.green_return  ?? 0;
  const kostprijs   = inkoop + ff + verzend + afdracht + green;
  const vk_excl     = line.verkoop_excl ?? 0;
  const marge_ps    = vk_excl - kostprijs;
  return {
    ...line,
    kostprijs,
    marge_per_stuk: marge_ps,
    totale_inkoop:  line.aantal * inkoop,
    totale_marge:   line.aantal * marge_ps,
  };
}
