import type { APIRoute } from "astro";
import QRCode from "qrcode";

/**
 * GET /api/pickup-qr?code=<waarde>
 *
 * Genereert een QR-code als PNG en retourneert die direct.
 * Bedoeld voor gebruik als <img src="..."> in Shopify e-mails.
 *
 * Shopify liquid voorbeeld:
 *   <img src="https://jouwdomein.com/api/pickup-qr?code={{ order.id }}" />
 *
 * Later eenvoudig te wisselen naar een veiliger token door
 * de `code` parameter te vervangen door een gesigneerde waarde.
 */
export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get("code")?.trim();

  // Validatie
  if (!code) {
    return new Response("Ontbrekende parameter: code", { status: 400 });
  }
  if (code.length > 500) {
    return new Response("Code te lang (max 500 tekens)", { status: 400 });
  }

  // Genereer PNG buffer server-side
  const buffer = await QRCode.toBuffer(code, {
    type: "png",
    errorCorrectionLevel: "M", // Medium: goede balans tussen foutcorrectie en grootte
    margin: 2,                 // Witte rand rondom de QR (in modules)
    scale: 8,                  // 8px per module → ~250px breed bij standaard QR
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Zelfde code = zelfde QR → voor altijd cacheable
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buffer.length),
    },
  });
};
