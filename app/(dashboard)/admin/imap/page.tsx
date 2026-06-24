"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Eye, EyeOff, Server } from "lucide-react";
import { useRouter } from "next/navigation";

type ImapFormData = {
  host: string;
  port: string;
  user: string;
  password: string;
  filterFrom: string;
  filterSubject: string;
  brevoApiKey: string;
};

export default function AdminImapPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authCheck, setAuthCheck] = useState<boolean | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState<ImapFormData>({
    host: "",
    port: "993",
    user: "",
    password: "",
    filterFrom: "",
    filterSubject: "",
    brevoApiKey: "",
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
            host: data.settings.host || "",
            port: data.settings.port || "993",
            user: data.settings.user || "",
            password: data.settings.password || "",
            filterFrom: data.settings.filterFrom || "",
            filterSubject: data.settings.filterSubject || "",
            brevoApiKey: data.settings.brevoApiKey || "",
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
          Configurazione IMAP
        </h2>
        <p className="text-muted-foreground">
          Gestisci le impostazioni del server email per la sincronizzazione
          automatica
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
                {/* Host */}
                <div className="space-y-2">
                  <Label htmlFor="host">Host IMAP</Label>
                  <Input
                    id="host"
                    placeholder="imaps.aruba.it"
                    value={form.host}
                    onChange={(e) => handleChange("host", e.target.value)}
                    required
                  />
                </div>

                {/* Port */}
                <div className="space-y-2">
                  <Label htmlFor="port">Porta</Label>
                  <Input
                    id="port"
                    placeholder="993"
                    value={form.port}
                    onChange={(e) => handleChange("port", e.target.value)}
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

                {/* Brevo API Key */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="brevoApiKey">
                    Chiave API Brevo (opzionale)
                  </Label>
                  <Input
                    id="brevoApiKey"
                    type="password"
                    placeholder="xkeysib-..."
                    value={form.brevoApiKey}
                    onChange={(e) =>
                      handleChange("brevoApiKey", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Inserisci la API key di Brevo per l&apos;invio di email
                    tramite API.
                  </p>
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
