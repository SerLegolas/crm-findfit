import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pagina HTML di conferma disiscrizione. */
function confirmationPage(): Response {
  const body = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Disiscrizione completata</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           background: #f1f5f9; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 40px 48px; max-width: 480px;
            width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .icon { font-size: 44px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #0f172a; margin: 0 0 12px; }
    p { font-size: 15px; color: #475569; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Disiscrizione completata</h1>
    <p>Sei stato disiscritto con successo. Non riceverai più email da questo CRM.</p>
  </div>
</body>
</html>`;
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * GET /api/email/opt-out?clientId=XXX&token=HMAC
 *
 * Endpoint PUBBLICO (nessuna autenticazione): la protezione è garantita dal token,
 * un HMAC-SHA256 del clientId firmato con EMAIL_OPT_OUT_SECRET.
 * Se valido, imposta email_consent = false e mostra la pagina di conferma.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || "";
  const token = searchParams.get("token") || "";

  if (!clientId || !token) {
    return NextResponse.json({ error: "Token non valido" }, { status: 400 });
  }

  // Recupera il cliente dal DB
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  // Verifica il token: HMAC-SHA256(clientId) firmato con EMAIL_OPT_OUT_SECRET
  const expected = createHmac("sha256", process.env.EMAIL_OPT_OUT_SECRET || "")
    .update(clientId)
    .digest("hex");

  if (expected !== token) {
    return NextResponse.json({ error: "Token non valido" }, { status: 400 });
  }

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  // Disiscrive il cliente (idempotente)
  await db
    .update(clients)
    .set({ emailConsent: false })
    .where(eq(clients.id, clientId));

  return confirmationPage();
}

