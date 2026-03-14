/**
 * Gedeelde hulpfuncties voor API routes.
 *
 * Doel: elimineer herhalende boilerplate (auth-fouten, JSON-parsing,
 * veldvalidatie) zodat elke API route zich focust op business logic.
 *
 * Gebruik:
 *   import { jsonOk, jsonError, parseBody, requireFields } from "../../../lib/api-helpers";
 */

// ── Response helpers ──────────────────────────────────────────────────────────

/** JSON 200/201 success response */
export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** JSON error response (standaard 400) */
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const UNAUTHORIZED = () => jsonError("Niet ingelogd", 401);
export const FORBIDDEN     = () => jsonError("Geen toegang", 403);
export const NOT_FOUND     = (what = "Niet gevonden") => jsonError(what, 404);
export const INVALID_JSON  = () => jsonError("Ongeldige JSON in request body", 400);

// ── Request parsing ───────────────────────────────────────────────────────────

type ParseOk<T>    = { data: T; error?: never };
type ParseErr      = { data?: never; error: Response };
type ParseResult<T> = ParseOk<T> | ParseErr;

/**
 * Parse JSON body veilig.
 * Retourneert `{ data }` bij succes, `{ error: Response }` bij ongeldige JSON.
 *
 * @example
 *   const parsed = await parseBody<{ name: string }>(request);
 *   if (parsed.error) return parsed.error;
 *   const { name } = parsed.data;
 */
export async function parseBody<T = Record<string, unknown>>(
  request: Request,
): Promise<ParseResult<T>> {
  try {
    const data = (await request.json()) as T;
    return { data };
  } catch {
    return { error: INVALID_JSON() };
  }
}

// ── Veldvalidatie ─────────────────────────────────────────────────────────────

/**
 * Controleer of verplichte string-velden aanwezig en niet leeg zijn.
 * Retourneert een foutbericht als een veld ontbreekt, anders null.
 *
 * @example
 *   const err = requireFields(body, ["name", "email"]);
 *   if (err) return jsonError(err);
 */
export function requireFields(
  body: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const f of fields) {
    const val = body[f];
    if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
      return `Veld '${f}' is verplicht`;
    }
  }
  return null;
}

// ── Numerieke helper ──────────────────────────────────────────────────────────

/**
 * Converteer een waarde naar number, of null als leeg/ongeldig.
 * Bedoeld voor optionele prijs/aantal-velden uit form-input.
 */
export function toNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ── Project context helper ────────────────────────────────────────────────────

import type { AuthResult } from "./auth";

/**
 * Extraheer project_id uit het auth-resultaat.
 * Nooit een fallback naar "eerste actieve project" — als project_id ontbreekt,
 * is dat een configuratiefout die zichtbaar moet zijn.
 *
 * @example
 *   const ctx = getProjectContext(auth);
 *   if (!ctx) return jsonError("Geen project-toegang geconfigureerd", 403);
 *   const { project_id } = ctx;
 */
export function getProjectContext(auth: AuthResult): { project_id: string; role: string } | null {
  if (auth.forbidden) return null;
  if (!auth.project?.project_id) return null;
  return { project_id: auth.project.project_id, role: auth.project.role };
}
