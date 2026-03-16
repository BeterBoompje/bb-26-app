/**
 * Domain: Reporting
 * Verantwoordelijk voor: read models voor rapportage-dashboards en CSV-exports.
 *
 * Architectuurprincipe: rapportageberekeningen horen in SQL views of RPC's,
 * niet in client-side JavaScript. Dit domein consumeert die read models.
 *
 * Toekomstige SQL views (toe te voegen als inventory_lines beschikbaar is):
 *   - v_inventory_overzicht    — gesommeerde voorraad per category_code + seizoen
 *   - v_verkoop_per_categorie  — verkochte aantallen via SKU-matching in SQL
 *   - v_locatie_matrix         — pickup_targets per locatie + datum
 */

/** Totaaloverzicht per boomtype (Tab 1 rapportage) */
export type InventoryOverzichtRow = {
  category_code: string;
  display_label: string | null;
  voorraad: number;
  ingekocht: number;
  extra: number;         // som van inventory_adjustments
  beschikbaar: number;   // voorraad + ingekocht + extra
  verkocht: number;      // via shopify_order_items SKU-matching
  restant: number;       // beschikbaar - verkocht
  /** Uitsplitsing per distributeur (voor uitklapbare rij) */
  distributors: DistributorBreakdown[];
};

export type DistributorBreakdown = {
  distributor_id: string;
  name: string;
  voorraad: number;
  ingekocht: number;
  extra: number;
};

/** Locatie & datum matrix (Tab 2 rapportage) */
export type LocatieMatrixRow = {
  locatie: string;
  datum: string | null;
  tijden: string | null;
  totaal: number;
  opgehaald: number;
  klaar: number;
  geblokkeerd: number;
};

/** Geaggregeerde totalen over een lijst rijen */
export function sumOverzicht(rows: InventoryOverzichtRow[]) {
  return rows.reduce(
    (acc, r) => {
      acc.voorraad   += r.voorraad;
      acc.ingekocht  += r.ingekocht;
      acc.extra      += r.extra;
      acc.beschikbaar += r.beschikbaar;
      acc.verkocht   += r.verkocht;
      acc.restant    += r.restant;
      return acc;
    },
    { voorraad: 0, ingekocht: 0, extra: 0, beschikbaar: 0, verkocht: 0, restant: 0 },
  );
}

export function sumLocatieMatrix(rows: LocatieMatrixRow[]) {
  return rows.reduce(
    (acc, r) => {
      acc.totaal      += r.totaal;
      acc.opgehaald   += r.opgehaald;
      acc.klaar       += r.klaar;
      acc.geblokkeerd += r.geblokkeerd;
      return acc;
    },
    { totaal: 0, opgehaald: 0, klaar: 0, geblokkeerd: 0 },
  );
}

/** Formatteer datum naar Nederlands kort formaat */
export function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
