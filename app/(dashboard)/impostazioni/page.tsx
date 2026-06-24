"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImpostazioniPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Impostazioni</h2>
        <p className="text-muted-foreground">
          Configurazione del sistema CRM
        </p>
      </div>

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
    </div>
  );
}
