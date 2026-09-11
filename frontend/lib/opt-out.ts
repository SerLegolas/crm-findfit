import { createHmac, timingSafeEqual } from "crypto";

/**
 * Link e token per l'opt-out (consenso email).
 * Il token è un HMAC-SHA256 del clientId firmato con EMAIL_OPT_OUT_SECRET:
 * solo chi conosce il secret può generarlo/verificarlo.
 */

/** Genera il token HMAC per un clientId. */
export function optOutToken(clientId: string): string {
  const secret = process.env.EMAIL_OPT_OUT_SECRET || "";
  return createHmac("sha256", secret).update(clientId).digest("hex");
}

/** Verifica che il token corrisponda al clientId (confronto a tempo costante). */
export function verifyOptOutToken(clientId: string, token: string): boolean {
  if (!token) return false;
  const expected = Buffer.from(optOutToken(clientId), "utf8");
  const provided = Buffer.from(token, "utf8");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/** Costruisce l'URL pubblico del link di disiscrizione. */
export function optOutUrl(clientId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = optOutToken(clientId);
  return `${base}/api/email/opt-out?clientId=${encodeURIComponent(clientId)}&token=${token}`;
}

/** Blocco HTML del link opt-out da inserire prima del footer delle email. */
export function optOutBlock(clientId: string): string {
  return `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
  <a href="${optOutUrl(clientId)}" style="color:#94a3b8;text-decoration:underline;">Non voglio più ricevere queste email</a>
</div>`;
}
