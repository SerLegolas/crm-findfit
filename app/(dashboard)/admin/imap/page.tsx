"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Eye, EyeOff, Send, Key, Globe, Filter, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <TooltipProvider delayDuration={300}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-6"
        >
          {/* ── Sezione 1: Credenziali ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Credenziali</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user" className="flex items-center gap-1">
                    Username / Email
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Email completa utilizzata per autenticazione</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="user"
                    placeholder="services@easyasso.cloud"
                    value={form.user}
                    onChange={(e) => handleChange("user", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-1">
                    Password
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Password dell'account email</TooltipContent>
                    </Tooltip>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => handleChange("password", e.target.value)}
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
              </div>
            </CardContent>
          </Card>

          {/* ── Sezione 2 e 3: SMTP + IMAP affiancati ── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Server SMTP */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Server SMTP</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Utilizza questa sezione per inserire i dati per l'invio delle email dal tuo provider.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="smtpHost" className="flex items-center gap-1">
                    Host
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Es. smtp.aruba.it</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.aruba.it"
                    value={form.smtpHost}
                    onChange={(e) => handleChange("smtpHost", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort" className="flex items-center gap-1">
                    Porta
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Es. 587 (TLS) o 465 (SSL)</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="smtpPort"
                    placeholder="587"
                    value={form.smtpPort}
                    onChange={(e) => handleChange("smtpPort", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpSecure" className="flex items-center gap-1">
                    SSL / TLS
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Abilita per connessioni sicure</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={form.smtpSecure}
                    onValueChange={(v) => handleChange("smtpSecure", v)}
                  >
                    <SelectTrigger id="smtpSecure">
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No (TLS / STARTTLS)</SelectItem>
                      <SelectItem value="true">Sì (SSL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Server IMAP */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Server IMAP</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Utilizza questa sezione per inserire i dati per la ricezione delle email dal tuo provider.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="imapHost" className="flex items-center gap-1">
                    Host
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Es. imaps.aruba.it</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="imapHost"
                    placeholder="imaps.aruba.it"
                    value={form.imapHost}
                    onChange={(e) => handleChange("imapHost", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imapPort" className="flex items-center gap-1">
                    Porta
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Es. 993 (SSL)</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="imapPort"
                    placeholder="993"
                    value={form.imapPort}
                    onChange={(e) => handleChange("imapPort", e.target.value)}
                    required
                  />
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filtri</span>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="filterFrom" className="flex items-center gap-1">
                        Mittente (opzionale)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>Solo email da questo indirizzo</TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="filterFrom"
                        placeholder="mittente@esempio.com"
                        value={form.filterFrom}
                        onChange={(e) => handleChange("filterFrom", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Solo email da questo mittente.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filterSubject" className="flex items-center gap-1">
                        Oggetto (opzionale)
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>Solo email con questa parola nell'oggetto</TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="filterSubject"
                        placeholder="parola chiave"
                        value={form.filterSubject}
                        onChange={(e) => handleChange("filterSubject", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Solo email con questa parola nell'oggetto.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
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
        </TooltipProvider>
      )}
    </div>
  );
}
