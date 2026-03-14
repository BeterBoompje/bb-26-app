const MISSING_TABLE_SNIPPET = "Could not find the table 'public.purchase_order_lines' in the schema cache";

export function isPurchaseOrderTableMissing(error: { message?: string | null } | string | null | undefined): boolean {
  const message = typeof error === "string" ? error : error?.message;
  return !!message && message.includes(MISSING_TABLE_SNIPPET);
}

export function getPurchaseOrderTableMissingMessage(): string {
  return "De inkoopmodule is nog niet gemigreerd in Supabase. Voer eerst migratie 20260314_purchase_orders.sql uit.";
}
