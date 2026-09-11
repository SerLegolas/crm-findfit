"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function SuperuserSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegisterButton, setShowRegisterButton] = useState(false);

  useEffect(() => {
    fetch("/api/global-settings?key=showRegisterButton")
      .then((res) => {
        if (res.status === 401) {
          router.push("/superuser/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setShowRegisterButton(data.value === "true");
      })
      .catch(() => router.push("/superuser/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleToggle = async () => {
    const newValue = !showRegisterButton;
    setSaving(true);

    try {
      const res = await fetch("/api/global-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "showRegisterButton",
          value: String(newValue),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({
          title: "Errore",
          description: err.error || "Salvataggio fallito",
          variant: "destructive",
        });
        return;
      }

      setShowRegisterButton(newValue);
      toast({
        title: "Impostazione aggiornata",
        description: `Bottone Registrati ${newValue ? "visibile" : "nascosto"}`,
      });
    } catch {
      toast({
        title: "Errore",
        description: "Errore di connessione",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Impostazioni Globali</h2>
        <p className="text-muted-foreground">
          Configurazioni applicate a tutte le aziende
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bottone Registrati</CardTitle>
              <CardDescription>
                Mostra o nascondi il pulsante "Registrati" nella pagina di login
              </CardDescription>
            </div>
            <button
              onClick={handleToggle}
              disabled={saving}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                showRegisterButton ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                  showRegisterButton ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stato attuale:{" "}
            <strong>{showRegisterButton ? "Visibile" : "Nascosto"}</strong>
          </p>
          {saving && (
            <p className="text-xs text-muted-foreground mt-2">Salvataggio in corso...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
