import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Banner giallo mostrato quando SMTP non è configurato:
 * nasconde i pulsanti "Nuova email"/"Nuovo template" e invita a configurare
 * il servizio email in /admin/imap.
 */
export function EmailConfigWarning() {
  return (
    <div
      role="alert"
      className="w-full flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700/60 dark:bg-amber-950/40"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-amber-900 dark:text-amber-200">
        Impossibile inviare email ai clienti.{" "}
        <Link
          href="/admin/imap"
          className="font-medium underline underline-offset-2 hover:opacity-80"
        >
          Configura un servizio email.
        </Link>
      </p>
    </div>
  );
}
