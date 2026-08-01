import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Converte l'errore ImapFlow in un messaggio dettagliato e comprensibile */
function imapErrorMessage(err: any): string {
  if (!err) return "Errore durante la connessione IMAP.";

  // Autenticazione fallita (ImapFlow lancia "Command failed" con questi dettagli)
  if (err.authenticationFailed || err.serverResponseCode === "AUTHENTICATIONFAILED") {
    return "Autenticazione fallita: username o password non corretti. Verifica le credenziali dell'account.";
  }

  // Il server ha risposto con un codice specifico (es. INBOX inesistente, quota, ecc.)
  if (err.serverResponseCode || err.responseStatus) {
    const text = err.responseText || err.response || err.message;
    return `Il server IMAP ha risposto: ${text}`;
  }

  // Errori di rete / TLS
  switch (err.code) {
    case "ENOTFOUND":
      return `Host non trovato: ${err.host || ""}. Verifica il nome del server IMAP.`;
    case "ECONNREFUSED":
      return `Connessione rifiutata dal server (${err.host || ""}:${err.port || ""}). Verifica host e porta.`;
    case "ETIMEDOUT":
    case "ESOCKETTIMEDOUT":
      return "Timeout di connessione. Verifica host, porta e rete.";
    case "ECONNRESET":
      return "Connessione interrotta dal server. Verifica che SSL/TLS sia configurato correttamente.";
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "CERT_HAS_EXPIRED":
      return `Errore certificato SSL: ${err.message}`;
  }

  return err.message || "Errore durante la connessione IMAP.";
}

/** POST: testa la connessione IMAP con le credenziali fornite e conta le email non lette */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e: any) {
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (e.message === "Forbidden") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }
    return NextResponse.json({ error: e.message || "Errore" }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { user, password, imapHost, imapPort } = body;

    if (!user || !password || !imapHost || !imapPort) {
      return NextResponse.json(
        {
          success: false,
          error: "Credenziali IMAP incomplete. Verifica user, password, imapHost e imapPort.",
        },
        { status: 400 }
      );
    }

    const port = parseInt(String(imapPort), 10);
    if (Number.isNaN(port) || port <= 0 || port > 65535) {
      return NextResponse.json(
        { success: false, error: `Porta IMAP non valida: ${imapPort}` },
        { status: 400 }
      );
    }

    const client = new ImapFlow({
      host: imapHost,
      port,
      secure: port === 993,
      auth: { user, pass: password },
      logger: false,
      connectionTimeout: 30000,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const rawResult = await client.search({ unseen: true } as any);
        const unseen = Array.isArray(rawResult) ? rawResult.length : 0;
        return NextResponse.json({ success: true, unseen });
      } finally {
        lock.release();
      }
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: imapErrorMessage(error),
      });
    } finally {
      try {
        await client.logout();
      } catch {
        // Connessione mai stabilita: ignora l'errore di logout
      }
    }
  } catch (error: any) {
    console.error("Errore test connessione IMAP:", error);
    return NextResponse.json({
      success: false,
      error: error?.message || "Errore sconosciuto.",
    });
  }
}
