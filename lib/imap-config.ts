import { db } from "@/lib/db";
import { imapSettings } from "@/lib/schema";
import { decrypt } from "@/lib/crypto";

export type ImapConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  filterFrom: string;
  filterSubject: string;
};

/**
 * Legge le impostazioni IMAP dal database (decriptate).
 * Se non presenti nel DB, cade sul fallback delle variabili d'ambiente.
 */
export async function getImapConfig(): Promise<ImapConfig | null> {
  try {
    const rows = await db.select().from(imapSettings).limit(1);
    if (rows.length === 0) {
      // Fallback su env
      const host = process.env.IMAP_HOST;
      const port = parseInt(process.env.IMAP_PORT || "993");
      const user = process.env.IMAP_USER;
      const password = process.env.IMAP_PASSWORD;
      const filterFrom = process.env.ARUBA_FILTER_FROM || "";

      if (!host || !user || !password) return null;

      return { host, port, user, password, filterFrom, filterSubject: "" };
    }

    const row = rows[0];
    return {
      host: decrypt(row.host),
      port: parseInt(decrypt(row.port)),
      user: decrypt(row.user),
      password: decrypt(row.password),
      filterFrom: decrypt(row.filterFrom),
      filterSubject: decrypt(row.filterSubject),
    };
  } catch {
    // Fallback su env in caso di errori
    const host = process.env.IMAP_HOST;
    const port = parseInt(process.env.IMAP_PORT || "993");
    const user = process.env.IMAP_USER;
    const password = process.env.IMAP_PASSWORD;
    const filterFrom = process.env.ARUBA_FILTER_FROM || "";

    if (!host || !user || !password) return null;

    return { host, port, user, password, filterFrom, filterSubject: "" };
  }
}
