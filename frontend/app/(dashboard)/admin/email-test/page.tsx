"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import HtmlEditor from "@/components/html-editor";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, AlertCircle, CheckCircle2, Mail } from "lucide-react";

export default function AdminEmailTestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authCheck, setAuthCheck] = useState<boolean | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [defaultSender, setDefaultSender] = useState("");

  const [form, setForm] = useState({
    to: "",
    subject: "",
    htmlContent: "",
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user || data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setAuthCheck(true);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (!authCheck) return;
    fetch("/api/imap-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.user) {
          setDefaultSender(data.settings.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [authCheck]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/email/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sender: defaultSender }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          message: data.error || "Errore nell'invio",
        });
        return;
      }

      setResult({
        success: true,
        message: `Email inviata con successo! ID: ${data.messageId}`,
      });
      toast({
        title: "Inviata",
        description: "Email inviata con successo.",
      });
    } catch {
      setResult({
        success: false,
        message: "Errore di connessione al server.",
      });
    } finally {
      setSending(false);
    }
  };

  if (authCheck === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fakeDate = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Test Invio Email</h2>
        <p className="text-muted-foreground">
          Invia un&apos;email di prova tramite SMTP Aruba per verificare la
          configurazione
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Colonna sinistra: form ── */}
        <Card>
          <CardHeader>
            <CardTitle>Componi Email</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mittente (caricato dalle impostazioni) */}
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span>
                  Mittente: <strong>{loadingSettings ? "Caricamento..." : defaultSender || "Non configurato"}</strong>
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Destinatario */}
                <div className="space-y-2">
                  <Label htmlFor="to">Destinatario</Label>
                  <Input
                    id="to"
                    type="email"
                    placeholder="cliente@example.com"
                    value={form.to}
                    onChange={(e) => handleChange("to", e.target.value)}
                    required
                  />
                </div>

                {/* Oggetto */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Oggetto</Label>
                  <Input
                    id="subject"
                    placeholder="Oggetto dell'email"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Corpo HTML */}
              <HtmlEditor
                id="htmlContent"
                label="Corpo HTML"
                value={form.htmlContent}
                onChange={(v) => handleChange("htmlContent", v)}
                placeholder="<h1>Benvenuto!</h1><p>Corpo dell'email...</p>"
              />

              {/* Result */}
              {result && (
                <div
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                    result.success
                      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{result.message}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Invia Email
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Colonna destra: anteprima live ── */}
        <Card className="lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle>Anteprima</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-4">
                {/* Header email */}
                <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden">
                  <div className="space-y-0 divide-y">
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm">
                      <span className="font-semibold text-muted-foreground w-12 shrink-0">Da:</span>
                      <span>{defaultSender || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm">
                      <span className="font-semibold text-muted-foreground w-12 shrink-0">A:</span>
                      <span>{form.to || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm">
                      <span className="font-semibold text-muted-foreground w-12 shrink-0">Oggetto:</span>
                      <span className="font-medium">{form.subject || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground">
                      <span className="font-semibold w-12 shrink-0">Data:</span>
                      <span>{fakeDate}</span>
                    </div>
                  </div>

                  {/* Corpo renderizzato */}
                  <div className="border-t px-4 py-4 min-h-[200px]">
                    {form.htmlContent ? (
                      <div
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: form.htmlContent }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Il corpo dell&apos;email apparirà qui...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
