"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Eye, EyeOff, Server, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ImapFormData = {
  imapHost: string;
  imapPort: string;
  user: string;
  password: string;
  filterFrom: string;
  filterSubject: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
};

export default function AdminImapPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authCheck, setAuthCheck] = useState<boolean | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState<ImapFormData>({
    imapHost: "",
    imapPort: "993",
    user: "",
    password: "",
    filterFrom: "",
    filterSubject: "",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: "false",
  });

  // Verifica auth e carica impostazioni
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
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  useEffect(() => {
    if (!authCheck) return;
    fetch("/api/imap-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setForm({
            imapHost: data.settings.imapHost || "",
            imapPort: data.settings.imapPort || "993",
            user: data.settings.user || "",
            password: data.settings.password || "",
            filterFrom: data.settings.filterFrom || "",
            filterSubject: data.settings.filterSubject || "",
            smtpHost: data.settings.smtpHost || "",
            smtpPort: data.settings.smtpPort || "587",
            smtpSecure: data.settings.smtpSecure ? "true" : "false",
          });
        }
      })
      .catch(() => {
        toast({
          title: "Errore",
          description: "Impossibile caricare le impostazioni IMAP.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [authCheck, toast]);

  const handleChange = (field: keyof ImapFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/imap-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore durante il salvataggio");
      }

      toast({
        title: "Salvato",
        description: "Impostazioni IMAP salvate con successo.",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
        <h2 className="text-2xl font-bold tracking-tight">
          Configurazione Email
        </h2>
        <p className="text-muted-foreground">
          Gestisci le impostazioni del server IMAP per la sincronizzazione e SMTP per l'invio email
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Server IMAP</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {/* IMAP Host */}
                <div className="space-y-2">
                  <Label htmlFor="imapHost">Host IMAP</Label>
                  <Input
                    id="imapHost"
                    placeholder="imaps.aruba.it"
                    value={form.imapHost}
                    onChange={(e) => handleChange("imapHost", e.target.value)}
                    required
                  />
                </div>

                {/* IMAP Port */}
                <div className="space-y-2">
                  <Label htmlFor="imapPort">Porta IMAP</Label>
                  <Input
                    id="imapPort"
                    placeholder="993"
                    value={form.imapPort}
                    onChange={(e) => handleChange("imapPort", e.target.value)}
                    required
                  />
                </div>

                {/* User */}
                <div className="space-y-2">
                  <Label htmlFor="user">Utente</Label>
                  <Input
                    id="user"
                    placeholder="services@easyasso.cloud"
                    value={form.user}
                    onChange={(e) => handleChange("user", e.target.value)}
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) =>
                        handleChange("password", e.target.value)
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Filter From */}
                <div className="space-y-2">
                  <Label htmlFor="filterFrom">
                    Filtra mittente (opzionale)
                  </Label>
                  <Input
                    id="filterFrom"
                    placeholder="e-ross1971@live.it"
                    value={form.filterFrom}
                    onChange={(e) =>
                      handleChange("filterFrom", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo email da questo mittente.
                  </p>
                </div>

                {/* Filter Subject */}
                <div className="space-y-2">
                  <Label htmlFor="filterSubject">
                    Filtra oggetto (opzionale)
                  </Label>
                  <Input
                    id="filterSubject"
                    placeholder="parola chiave nell'oggetto"
                    value={form.filterSubject}
                    onChange={(e) =>
                      handleChange("filterSubject", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo email con questa parola nell'oggetto.
                  </p>
                </div>

              </div>

              {/* ── SMTP Section ── */}
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Server SMTP (invio email)</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Se lasci vuoti questi campi, verranno usati gli stessi valori di IMAP. Usa la stessa user/password di IMAP.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="smtpHost">Host SMTP</Label>
                    <Input
                      id="smtpHost"
                      placeholder="smtp.aruba.it"
                      value={form.smtpHost}
                      onChange={(e) => handleChange("smtpHost", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">Porta SMTP</Label>
                    <Input
                      id="smtpPort"
                      placeholder="587"
                      value={form.smtpPort}
                      onChange={(e) => handleChange("smtpPort", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpSecure">Connessione sicura</Label>
                    <Select
                      value={form.smtpSecure}
                      onValueChange={(v) => handleChange("smtpSecure", v)}
                    >
                      <SelectTrigger id="smtpSecure">
                        <SelectValue placeholder="Seleziona..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">No (TLS/STARTTLS)</SelectItem>
                        <SelectItem value="true">Sì (SSL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salva impostazioni
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
