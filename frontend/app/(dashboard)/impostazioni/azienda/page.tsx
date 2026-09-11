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
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Pencil } from "lucide-react";

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
  footerAttivo: boolean;
}

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

export default function ImpostazioniAziendaPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<{ role: string } | null>(null);

  // Dati azienda
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<CompanyData>({
    denominazione: "", piva: "", cf: "", indirizzo: "",
    città: "", provincia: "", cap: "", email: "", telefono: "",
    footerAttivo: false,
  });
  const [savingCompany, setSavingCompany] = useState(false);

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
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) setUser(json.user);
      })
      .catch(() => {});
    fetchCompany();
  }, []);

  // Accesso riservato agli admin (coerente con la vecchia tab)
  if (user && user.role !== "admin") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Impostazioni Azienda</h2>
          <p className="text-muted-foreground">
            Dati anagrafici della tua azienda.
          </p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Accesso riservato agli amministratori.
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Impostazioni Azienda</h2>
          <p className="text-muted-foreground">
            Dati anagrafici della tua azienda.
          </p>
        </div>

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
                    value={String(editForm[key] ?? "")}
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
