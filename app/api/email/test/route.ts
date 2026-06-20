import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getImapConfig } from "@/lib/imap-config";
import { parseContactRequest, processContactRequest } from "@/lib/email-parser";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    console.log("[TEST-EMAIL] Lettura configurazione IMAP dal DB...");
    let config;
    try {
      config = await getImapConfig();
    } catch (decryptErr: any) {
      console.error("[TEST-EMAIL] Errore decriptazione impostazioni:", decryptErr.message);
      return NextResponse.json(
        { error: "Configura prima le impostazioni email in /impostazioni — dati criptati non validi." },
        { status: 400 }
      );
    }

    if (!config) {
      console.warn("[TEST-EMAIL] Nessuna configurazione IMAP trovata (DB vuoto e nessun fallback env).");
      return NextResponse.json(
        { error: "Configura prima le impostazioni email in /impostazioni." },
        { status: 400 }
      );
    }

    console.log("[TEST-EMAIL] Config OK →", { host: config.host, user: config.user, filterFrom: config.filterFrom });

    const { host, port, user, password, filterFrom, filterSubject } = config;
    const filterFromLower = filterFrom.toLowerCase();
    const filterSubjectLower = filterSubject.toLowerCase();

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass: password },
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      const rawResult = await client.search({ unseen: true } as any);
      const searchResult: number[] = Array.isArray(rawResult) ? rawResult : [];
      const uidList = searchResult;

      const emails: {
        mittente: string;
        oggetto: string;
        bodyText: string;
        data: string;
        crmAction?: string;
      }[] = [];
      let filtrate = 0;

      for (const uid of uidList) {
        // Recupera source grezzo
        const message = (await client.fetchOne(uid, { source: true })) as any;

        // Parsing completo con mailparser
        let parsed;
        try {
          parsed = await simpleParser(message.source as Buffer);
        } catch {
          continue;
        }

        // Filtra per mittente
        const fromAddress =
          parsed.from && parsed.from.value && parsed.from.value.length > 0
            ? parsed.from.value[0].address?.toLowerCase() || ""
            : "";

        if (filterFromLower && fromAddress !== filterFromLower) {
          filtrate++;
          continue;
        }

        // Filtra per oggetto
        const oggetto = parsed.subject || "";
        if (filterSubjectLower && !oggetto.toLowerCase().includes(filterSubjectLower)) {
          filtrate++;
          continue;
        }

        // Mittente formattato
        const mittente =
          parsed.from && parsed.from.value && parsed.from.value.length > 0
            ? `${parsed.from.value[0].name || ""} <${parsed.from.value[0].address}>`.trim()
            : "Sconosciuto";

        // Oggetto (gia calcolato sopra)

        // Data
        const data = parsed.date
          ? new Date(parsed.date).toLocaleString("it-IT")
          : "";

        // Corpo
        const bodyText = (parsed.text || parsed.html || "").trim();

        // Parsing richiesta contatto
        let crmAction: string | undefined;
        const contactData = parseContactRequest(bodyText);
        if (contactData) {
          try {
            crmAction = await processContactRequest(contactData);
          } catch (err: any) {
            console.error("Errore processContactRequest:", err);
          }
        }

        emails.push({ mittente, oggetto, bodyText, data, crmAction });

        // Segna l'email come letta su Aruba
        await client.messageFlagsAdd(uid, ["\\Seen"]);
      }

      return NextResponse.json({
        emails,
        totali: uidList.length,
        filtrate,
        letti: emails.length,
      });
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (error: any) {
    console.error("Errore IMAP:", error);
    return NextResponse.json(
      {
        error: `Errore durante la connessione IMAP: ${error.message || "Errore sconosciuto"}`,
      },
      { status: 500 }
    );
  }
}
