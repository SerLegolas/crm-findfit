"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Loader2, AlertCircle } from "lucide-react";

interface Email {
  mittente: string;
  oggetto: string;
  bodyText: string;
  data: string;
}

export default function TestEmailPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totali, setTotali] = useState<number>(0);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/test");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Errore sconosciuto");
        setEmails([]);
      } else {
        setEmails(data.emails || []);
        setTotali(data.totali || 0);
      }
    } catch (err: any) {
      setError(err.message || "Errore di connessione");
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Email</h1>
          <p className="text-muted-foreground">
            Leggi le ultime email non lette dalla casella IMAP Aruba
          </p>
        </div>
        <Button onClick={fetchEmails} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Lettura in corso...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Leggi Email
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && emails.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Mostrate {emails.length} email su {totali} non lette totali.
        </p>
      )}

      {!loading && emails.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Mail className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Premi "Leggi Email" per recuperare le ultime email non lette.
          </p>
        </div>
      )}

      {emails.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mittente</TableHead>
                <TableHead>Oggetto</TableHead>
                <TableHead>Corpo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email, index) => (
                <TableRow
                  key={index}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => {
                    setSelectedEmail(email);
                    setModalOpen(true);
                  }}
                >
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {email.mittente}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {email.oggetto}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground">
                    {email.bodyText
                      ? email.bodyText.length > 200
                        ? email.bodyText.substring(0, 200) + "..."
                        : email.bodyText
                      : "(corpo non disponibile)"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {email.data}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog dettaglio email */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Dettaglio Email</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <span className="font-medium text-muted-foreground">Mittente</span>
                <span>{selectedEmail.mittente}</span>
                <span className="font-medium text-muted-foreground">Oggetto</span>
                <span>{selectedEmail.oggetto}</span>
                <span className="font-medium text-muted-foreground">Data</span>
                <span>{selectedEmail.data}</span>
              </div>
              <hr />
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {selectedEmail.bodyText || "(corpo non disponibile)"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
