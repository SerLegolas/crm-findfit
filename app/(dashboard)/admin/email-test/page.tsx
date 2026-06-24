"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, AlertCircle, CheckCircle2 } from "lucide-react";

export default function AdminEmailTestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authCheck, setAuthCheck] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    sender: "",
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
        body: JSON.stringify(form),
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Test Invio Email</h2>
        <p className="text-muted-foreground">
          Invia un&apos;email di prova tramite API Brevo per verificare la
          configurazione
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Componi Email</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Mittente */}
              <div className="space-y-2">
                <Label htmlFor="sender">Mittente (email)</Label>
                <Input
                  id="sender"
                  type="email"
                  placeholder="noreply@findfit.it"
                  value={form.sender}
                  onChange={(e) => handleChange("sender", e.target.value)}
                  required
                />
              </div>

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

            {/* Corpo HTML */}
            <div className="space-y-2">
              <Label htmlFor="htmlContent">Corpo HTML</Label>
              <Textarea
                id="htmlContent"
                placeholder={`<h1>Benvenuto!</h1><p>Corpo dell'email...</p>`}
                value={form.htmlContent}
                onChange={(e) => handleChange("htmlContent", e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                required
              />
            </div>

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
    </div>
  );
}
