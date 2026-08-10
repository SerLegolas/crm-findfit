"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

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

export default function ImpostazioniGeneraliPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);

  const fetchCompany = async () => {
    try {
      const res = await fetch("/api/company-settings");
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
      }
    } catch {
      // silent
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
          <h2 className="text-2xl font-bold tracking-tight">Impostazioni Generali</h2>
          <p className="text-muted-foreground">
            Preferenze generali del CRM e footer delle email.
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Impostazioni Generali</h2>
        <p className="text-muted-foreground">
          Preferenze generali del CRM e footer delle email.
        </p>
      </div>

      {/* Configurazione */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurazione</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Le impostazioni di configurazione saranno disponibili in una
            versione futura.
          </p>
        </CardContent>
      </Card>

      {/* Footer Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Footer Email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="footer-attivo"
              title="Attiva footer email"
              checked={company?.footerAttivo ?? false}
              onChange={async (e) => {
                const checked = e.target.checked;
                try {
                  // Carica i dati correnti dell'azienda per non sovrascrivere con vuoti
                  const currRes = await fetch("/api/company-settings");
                  const currData = await currRes.json();
                  const formData = new FormData();
                  Object.entries(currData).forEach(([key, val]) => {
                    if (key !== "id") formData.append(key, String(val ?? ""));
                  });
                  formData.set("footerAttivo", String(checked));

                  const res = await fetch("/api/company-settings", {
                    method: "PUT",
                    body: formData,
                  });

                  if (!res.ok) throw new Error();
                  toast({ title: "Impostazione salvata", variant: "success" as any });
                  fetchCompany();
                } catch {
                  toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
                }
              }}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div>
              <Label htmlFor="footer-attivo" className="font-medium cursor-pointer">
                Aggiungi dati azienda al footer delle email
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Se attivo, verranno automaticamente aggiunti in fondo alle email inviate:
                denominazione, indirizzo, telefono, email, P.IVA e C.F.
              </p>
              {company?.footerAttivo && company?.denominazione && (
                <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs text-center text-muted-foreground">
                  <strong>Anteprima footer:</strong><br />
                  {company.denominazione}<br />
                  {[company.indirizzo, company.città, company.provincia].filter(Boolean).join(", ")} {company.cap}<br />
                  Tel: {company.telefono} - Email: {company.email}<br />
                  P.IVA: {company.piva} - C.F.: {company.cf}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
