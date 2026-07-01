"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Save,
  User,
  Lock,
  Building2,
  Pencil,
} from "lucide-react";

type Tab = "generali" | "utente" | "azienda";

interface CompanyData {
  denominazione: string;
  piva: string;
  cf: string;
  indirizzo: string;
  città: string;
  provincia: string;
  cap: string;
  email: string;
  telefono: string;
}

export default function ImpostazioniPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("generali");

  // Utente loggato
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  // Cambio password
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  // Dati azienda
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<CompanyData>({
    denominazione: "", piva: "", cf: "", indirizzo: "",
    città: "", provincia: "", cap: "", email: "", telefono: "",
  });
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) setUser(json.user);
      })
      .catch(() => {});
  }, []);

  const fetchCompany = async () => {
    setCompanyLoading(true);
    try {
      const res = await fetch("/api/company-settings");
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
      }
    } catch {
      // silent
    } finally {
      setCompanyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "azienda") fetchCompany();
  }, [activeTab]);

  const openEditDialog = () => {
    if (!company) return;
    setEditForm({ ...company });
    setEditDialogOpen(true);
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      const formData = new FormData();
      Object.entries(editForm).forEach(([key, val]) => {
        formData.append(key, val);
      });

      const res = await fetch("/api/company-settings", {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error || "Salvataggio fallito", variant: "destructive" });
        return;
      }

      toast({ title: "Dati azienda aggiornati", variant: "success" as any });
      setEditDialogOpen(false);
      fetchCompany();
    } catch {
      toast({ title: "Errore", description: "Errore durante il salvataggio", variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword.length < 6) {
      toast({ title: "Errore", description: "La password deve essere di almeno 6 caratteri", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Errore", description: "Le password non coincidono", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error || "Operazione fallita", variant: "destructive" });
        return;
      }

      toast({ title: "Password aggiornata", variant: "success" as any });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch {
      toast({ title: "Errore", description: "Errore durante il cambio password", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "generali", label: "Generali" },
    { key: "utente", label: "Utente" },
    { key: "azienda", label: "Azienda" },
  ];

  const companyFields: { key: keyof CompanyData; label: string }[] = [
    { key: "denominazione", label: "Denominazione" },
    { key: "piva", label: "Partita IVA" },
    { key: "cf", label: "Codice Fiscale" },
    { key: "indirizzo", label: "Indirizzo" },
    { key: "città", label: "Città" },
    { key: "provincia", label: "Provincia" },
    { key: "cap", label: "CAP" },
    { key: "email", label: "Email" },
    { key: "telefono", label: "Telefono" },
  ];

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Impostazioni</h2>
        <p className="text-muted-foreground">
          Configurazione del sistema CRM
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.key === "generali" && <User className="h-4 w-4" />}
              {tab.key === "utente" && <Lock className="h-4 w-4" />}
              {tab.key === "azienda" && <Building2 className="h-4 w-4" />}
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* TAB: Generali */}
      {activeTab === "generali" && (
        <Card>
          <CardHeader>
            <CardTitle>Impostazioni Generali</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Le impostazioni di configurazione saranno disponibili in una
              versione futura.
            </p>
          </CardContent>
        </Card>
      )}

      {/* TAB: Utente */}
      {activeTab === "utente" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Dati utente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dati utente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <p className="text-sm font-medium">{user?.name || "—"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm font-medium">{user?.email || "—"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ruolo</Label>
                <p className="text-sm font-medium capitalize">{user?.role || "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Cambia password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cambia password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nuova password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Minimo 6 caratteri"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Conferma password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Ripeti la password"
                  />
                </div>
                <div className="flex justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="default" size="icon" type="submit" disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Salva password</TooltipContent>
                  </Tooltip>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: Azienda */}
      {activeTab === "azienda" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Dati Azienda</CardTitle>
            {user?.role === "admin" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" size="icon" onClick={openEditDialog}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifica</TooltipContent>
              </Tooltip>
            )}
          </CardHeader>
          <CardContent>
            {companyLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : company ? (
              <div className="grid gap-4 sm:grid-cols-2">
                  {companyFields.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <p className="text-sm font-medium">{company[key] || "—"}</p>
                    </div>
                  ))}
                </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nessun dato inserito</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog modifica dati azienda */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Dati Azienda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {companyFields.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={editForm[key] || ""}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                />
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSaveCompany} disabled={savingCompany}>
                {savingCompany && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
