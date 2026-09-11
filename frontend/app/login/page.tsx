"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { APP_VERSION_LABEL } from "@/lib/app-version";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    fetch("/api/global-settings?key=showRegisterButton")
      .then((r) => r.json())
      .then((data) => setShowRegister(data.value === "true"))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Se email === "ADMIN", tenta login Super Admin
      if (email.trim().toUpperCase() === "ADMIN") {
        const res = await fetch("/api/superuser/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "ADMIN", password }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast({
            title: "Errore",
            description: err.error || "Credenziali non valide",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        router.push("/superuser/dashboard");
        return;
      }

      // Login CRM normale
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({
          title: "Errore",
          description: err.error || "Credenziali non valide",
          variant: "destructive",
        });
        return;
      }

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CRM FindFit</CardTitle>
          <CardDescription>Accedi con le tue credenziali</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
          {showRegister && (
            <div className="mt-2 space-y-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    oppure
                  </span>
                </div>
              </div>
              <Link href="/register">
                <Button variant="outline" className="w-full mt-2.5">
                  Registrati
                </Button>
              </Link>
            </div>
          )}
          {APP_VERSION_LABEL && (
            <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground italic">
              Ver: {APP_VERSION_LABEL}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
