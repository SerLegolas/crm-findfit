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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save } from "lucide-react";

export default function ImpostazioniUtentePage() {
  const { toast } = useToast();

  // Utente loggato
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  // Cambio password
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) setUser(json.user);
      })
      .catch(() => {});
  }, []);

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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Impostazioni Utente</h2>
          <p className="text-muted-foreground">
            I tuoi dati e la gestione della password.
          </p>
        </div>

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
      </div>
    </TooltipProvider>
  );
}
