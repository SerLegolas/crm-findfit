"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Eye, EyeOff, Send, Key, Globe, Filter, HelpCircle, Wand2, Zap } from "lucide-react";
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

type ProviderConfig = {
  name: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
};

// Configurazione Aruba (usata sia dalla mappa domini sia dal rilevamento DNS)
const ARUBA_CONFIG: ProviderConfig = {
  name: "Aruba",
  imapHost: "imaps.aruba.it",
  imapPort: "993",
  smtpHost: "smtps.aruba.it",
  smtpPort: "465",
  smtpSecure: "true",
};

// Configurazioni dei provider supportati per l'auto-compilazione
const PROVIDER_DOMAINS: Record<string, ProviderConfig> = {
  // Aruba: caselle @aruba.it, hosting e tutti i domini PEC Aruba
  "aruba.it": ARUBA_CONFIG,
  "pec.aruba.it": ARUBA_CONFIG,
  "arubapec.it": ARUBA_CONFIG,
  "arubapec.eu": ARUBA_CONFIG,
  "legalmail.it": ARUBA_CONFIG,
  "legalmail.eu": ARUBA_CONFIG,
  "actaliscertymail.it": ARUBA_CONFIG,
  "ancert.it": ARUBA_CONFIG,
  "messaggipec.it": ARUBA_CONFIG,
  "email.it": ARUBA_CONFIG,
  "email.aruba.it": ARUBA_CONFIG,
  // Domini specifici hostati su Aruba (aggiunti manualmente, indipendenti dal DNS)
  "finfit.it": ARUBA_CONFIG,
  "gmail.com": { name: "Google", imapHost: "imap.gmail.com", imapPort: "993", smtpHost: "smtp.gmail.com", smtpPort: "587", smtpSecure: "false" },
  "googlemail.com": { name: "Google", imapHost: "imap.gmail.com", imapPort: "993", smtpHost: "smtp.gmail.com", smtpPort: "587", smtpSecure: "false" },
  "outlook.com": { name: "Microsoft", imapHost: "outlook.office365.com", imapPort: "993", smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: "false" },
  "outlook.it": { name: "Microsoft", imapHost: "outlook.office365.com", imapPort: "993", smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: "false" },
  "hotmail.com": { name: "Microsoft", imapHost: "outlook.office365.com", imapPort: "993", smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: "false" },
  "hotmail.it": { name: "Microsoft", imapHost: "outlook.office365.com", imapPort: "993", smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: "false" },
  "live.com": { name: "Microsoft", imapHost: "outlook.office365.com", imapPort: "993", smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: "false" },
  "live.it": { name: "Microsoft", imapHost: "outlook.office365.com", imapPort: "993", smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: "false" },
  "microsoft.com": { name: "Microsoft", imapHost: "outlook.office365.com", imapPort: "993", smtpHost: "smtp.office365.com", smtpPort: "587", smtpSecure: "false" },
  "libero.it": { name: "Libero", imapHost: "imap.libero.it", imapPort: "993", smtpHost: "smtp.libero.it", smtpPort: "587", smtpSecure: "false" },
  "virgilio.it": { name: "Virgilio", imapHost: "imap.virgilio.it", imapPort: "993", smtpHost: "smtp.virgilio.it", smtpPort: "587", smtpSecure: "false" },
  "iol.it": { name: "Italia Online", imapHost: "imap.iol.it", imapPort: "993", smtpHost: "smtp.iol.it", smtpPort: "587", smtpSecure: "false" },
  "inwind.it": { name: "Italia Online", imapHost: "imap.iol.it", imapPort: "993", smtpHost: "smtp.iol.it", smtpPort: "587", smtpSecure: "false" },
  "tim.it": { name: "TIM", imapHost: "imap.tim.it", imapPort: "993", smtpHost: "smtp.tim.it", smtpPort: "587", smtpSecure: "false" },
  "alice.it": { name: "TIM", imapHost: "imap.alice.it", imapPort: "993", smtpHost: "smtp.alice.it", smtpPort: "587", smtpSecure: "false" },
  "tiscali.it": { name: "Tiscali", imapHost: "imap.tiscali.it", imapPort: "993", smtpHost: "smtp.tiscali.it", smtpPort: "587", smtpSecure: "false" },
  "yahoo.com": { name: "Yahoo", imapHost: "imap.mail.yahoo.com", imapPort: "993", smtpHost: "smtp.mail.yahoo.com", smtpPort: "587", smtpSecure: "false" },
  "yahoo.it": { name: "Yahoo", imapHost: "imap.mail.yahoo.com", imapPort: "993", smtpHost: "smtp.mail.yahoo.com", smtpPort: "587", smtpSecure: "false" },
  "icloud.com": { name: "iCloud", imapHost: "imap.mail.me.com", imapPort: "993", smtpHost: "smtp.mail.me.com", smtpPort: "587", smtpSecure: "false" },
  "me.com": { name: "iCloud", imapHost: "imap.mail.me.com", imapPort: "993", smtpHost: "smtp.mail.me.com", smtpPort: "587", smtpSecure: "false" },
  "zoho.com": { name: "Zoho", imapHost: "imap.zoho.com", imapPort: "993", smtpHost: "smtp.zoho.com", smtpPort: "587", smtpSecure: "false" },
  "zoho.eu": { name: "Zoho", imapHost: "imap.zoho.eu", imapPort: "993", smtpHost: "smtp.zoho.eu", smtpPort: "587", smtpSecure: "false" },
};

const getProviderConfig = (email: string): ProviderConfig | null => {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return null;
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  return PROVIDER_DOMAINS[domain] || null;
};

// Campi obbligatori per il test di connessione
const REQUIRED_TEST_FIELDS: { key: keyof ImapFormData; label: string }[] = [
  { key: "user", label: "Username / Email" },
  { key: "password", label: "Password" },
  { key: "imapHost", label: "Host IMAP" },
  { key: "imapPort", label: "Porta IMAP" },
  { key: "smtpHost", label: "Host SMTP" },
  { key: "smtpPort", label: "Porta SMTP" },
];

export default function AdminImapPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authCheck, setAuthCheck] = useState<boolean | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState<ImapFormData>({
    imapHost: "",
    imapPort: "",
    user: "",
    password: "",
    filterFrom: "",
    filterSubject: "",
    smtpHost: "",
    smtpPort: "",
    smtpSecure: "",
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
            imapPort: data.settings.imapPort || "",
            user: data.settings.user || "",
            password: data.settings.password || "",
            filterFrom: data.settings.filterFrom || "",
            filterSubject: data.settings.filterSubject || "",
            smtpHost: data.settings.smtpHost || "",
            smtpPort: data.settings.smtpPort || "",
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

  const applyConfig = (config: ProviderConfig) => {
    setForm((prev) => ({
      ...prev,
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
    }));
  };

  // Verifica via DNS se il dominio dell'email è ospitato su Aruba (NS, MX e IP dei server MX)
  const checkArubaDomain = async (
    email: string
  ): Promise<{ isAruba: boolean; dnsError: string | null }> => {
    try {
      const res = await fetch("/api/check-email-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) return { isAruba: false, dnsError: "ERROR" };

      const data = await res.json();
      if (data.isAruba) {
        applyConfig(ARUBA_CONFIG);
      }
      return { isAruba: !!data.isAruba, dnsError: data.dnsError || null };
    } catch {
      return { isAruba: false, dnsError: "ERROR" };
    }
  };

  const handleAutofill = async () => {
    const email = form.user.trim();
    if (!email) {
      toast({
        title: "Campo vuoto",
        description: "Inserisci prima un indirizzo email nel campo Username / Email.",
        variant: "destructive",
      });
      return;
    }

    const config = getProviderConfig(email);
    if (config) {
      applyConfig(config);
      toast({
        title: "Auto-compilazione completata",
        description: `Configurazione ${config.name} applicata ai campi SMTP e IMAP.`,
      });
      return;
    }

    // Dominio non in elenco: prova il rilevamento DNS Aruba
    setAutofilling(true);
    try {
      const { isAruba, dnsError } = await checkArubaDomain(email);
      if (isAruba) {
        toast({
          title: "Auto-compilazione completata",
          description: `Dominio rilevato su Aruba (DNS): configurazione ${ARUBA_CONFIG.name} applicata ai campi SMTP e IMAP.`,
        });
      } else if (dnsError) {
        toast({
          title: "Dominio non risolvibile",
          description: `Il dominio ${email.split("@")[1]} non ha record DNS (${dnsError}). Verifica che il dominio sia attivo e configurato.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Dominio non riconosciuto",
          description: "Dominio non riconosciuto, seleziona manualmente.",
          variant: "destructive",
        });
      }
    } finally {
      setAutofilling(false);
    }
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

  const handleTest = async () => {
    const missing = REQUIRED_TEST_FIELDS.find((f) => !form[f.key].trim());
    if (missing) {
      toast({
        title: "Campi mancanti",
        description: `Compila il campo "${missing.label}" prima di testare la connessione.`,
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/imap/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast({
          title: "✅ Connessione riuscita!",
          description: `Email non lette: ${data.unseen}`,
        });
      } else {
        toast({
          title: "❌ Errore",
          description: data.error || "Impossibile testare la connessione.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "❌ Errore",
        description: error.message || "Impossibile testare la connessione.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
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
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutofill}
                  disabled={autofilling}
                >
                  {autofilling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifica dominio...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Auto-compila
                    </>
                  )}
                </Button>
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
                      <SelectValue />
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
                    value={form.imapPort}
                    onChange={(e) => handleChange("imapPort", e.target.value)}
                    required
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Sezione 4: Filtri Email ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Filtri Email</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
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
                    value={form.filterSubject}
                    onChange={(e) => handleChange("filterSubject", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo email con questa parola nell'oggetto.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Test in corso...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Test connessione
                </>
              )}
            </Button>
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
