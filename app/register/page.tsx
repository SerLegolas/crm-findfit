"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    fetch("/version.json")
      .then((r) => r.json())
      .then((data) => {
        if (data.version) setAppVersion(data.version);
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Controlla che tutti i campi siano compilati
    const { companyName, email, password, confirmPassword } = formData;
    if (!companyName.trim() || !email.trim() || !password || !confirmPassword) {
      toast({
        title: "Errore",
        description: "Tutti i campi sono obbligatori",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Validazione formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Errore",
        description: "Inserisci un'email valida",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Errore",
          description: data.error || "Registrazione fallita",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Registrazione completata",
        description: "Benvenuto! Reindirizzamento in corso...",
      });

      router.push("/dashboard");
    } catch {
      toast({
        title: "Errore",
        description: "Errore di connessione",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CRM FindFit</CardTitle>
          <CardDescription>Crea il tuo account aziendale</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome Azienda</Label>
              <Input
                id="companyName"
                placeholder="La tua azienda"
                value={formData.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Admin</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@esempio.com"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimo 6 caratteri"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Ripeti la password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registrazione in corso..." : "Registrati"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Hai già un account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Accedi
            </Link>
          </div>
          {appVersion && (
            <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground italic">
              Ver: {appVersion}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
