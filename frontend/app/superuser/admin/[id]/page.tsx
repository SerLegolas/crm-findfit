"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Shield,
  Users,
  ArrowLeft,
  Building2,
  Save,
  Check,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const FEATURE_OPTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clienti", label: "Clienti" },
  { key: "kanban", label: "Kanban" },
  { key: "task", label: "Task" },
  { key: "note", label: "Note" },
  { key: "email", label: "Email" },
  { key: "analisi", label: "Analisi" },
  { key: "template", label: "Template" },
  { key: "comunicazioni", label: "Comunicazioni" },
  { key: "impostazioni", label: "Impostazioni" },
];

const ADMIN_FEATURE_OPTIONS = [
  { key: "gestione_utenti", label: "Gestione Utenti" },
  { key: "configurazione_email", label: "Configurazione Email" },
  { key: "recupero_email", label: "Recupero Email" },
  { key: "facebook_post", label: "Facebook Post" },
];

// Etichette per i conteggi mostrati nel modal di eliminazione
const COUNT_LABELS = [
  { key: "users", label: "Utenti" },
  { key: "clients", label: "Clienti" },
  { key: "tasks", label: "Task" },
  { key: "notes", label: "Note" },
  { key: "emailLog", label: "Email Log" },
  { key: "emailTemplates", label: "Template Email" },
  { key: "imapSettings", label: "Impostazioni IMAP" },
  { key: "companySettings", label: "Impostazioni Azienda" },
  { key: "companyRules", label: "Regole Azienda" },
  { key: "cronLog", label: "Log Cron" },
  { key: "comunicazioni", label: "Comunicazioni" },
  { key: "comunicazioniBatch", label: "Batch Comunicazioni" },
  { key: "savedAnalyses", label: "Analisi Salvate" },
];

interface AdminDetail {
  id: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
  createdAt: number;
  users: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: number;
  }[];
}

interface CompanyRule {
  id: string;
  companyId: string;
  maxUsers: number;
  maxClients: number;
  maxTasks: number;
  features: Record<string, boolean>;
  featuresAdmin: Record<string, boolean>;
}

export default function AdminDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminDetail | null>(null);
  const [rule, setRule] = useState<CompanyRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formMaxUsers, setFormMaxUsers] = useState("0");
  const [formMaxClients, setFormMaxClients] = useState("0");
  const [formMaxTasks, setFormMaxTasks] = useState("0");
  const [formFeatures, setFormFeatures] = useState<Record<string, boolean>>({});
  const [formFeaturesAdmin, setFormFeaturesAdmin] = useState<Record<string, boolean>>({});

  // Eliminazione azienda
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCounts, setDeleteCounts] = useState<Record<string, number> | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/superuser/admins/${params.id}`)
      .then(async (adminRes) => {
        if (adminRes.status === 401) {
          router.push("/superuser/login");
          return null;
        }
        const adminData = await adminRes.json();
        setAdmin(adminData);

        // Carica le regole usando il companyId dell'admin
        if (adminData.companyId) {
          const rulesRes = await fetch(
            `/api/superuser/company-rules?companyId=${adminData.companyId}`
          );
          const ruleData = await rulesRes.json();
          setRule(ruleData);
          if (ruleData) {
            setFormMaxUsers(String(ruleData.maxUsers));
            setFormMaxClients(String(ruleData.maxClients));
            setFormMaxTasks(String(ruleData.maxTasks));
            setFormFeatures(ruleData.features ?? {});
            setFormFeaturesAdmin(ruleData.featuresAdmin ?? {});
          }
        }
      })
      .catch(() => router.push("/superuser/login"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  function toggleFeature(key: string) {
    setFormFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function toggleAdminFeature(key: string) {
    setFormFeaturesAdmin((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function handleSaveRules() {
    if (!admin) return;
    setSaving(true);
    try {
      const res = await fetch("/api/company-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: admin.companyId,
          maxUsers: parseInt(formMaxUsers) || 0,
          maxClients: parseInt(formMaxClients) || 0,
          maxTasks: parseInt(formMaxTasks) || 0,
          features: formFeatures,
          featuresAdmin: formFeaturesAdmin,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRule(updated);
      } else {
        const err = await res.json();
        console.error("Errore salvataggio regole:", err);
      }
    } finally {
      setSaving(false);
    }
  }

  // Apre il modal e carica i conteggi dei dati collegati
  async function openDeleteDialog() {
    if (!admin) return;
    setDeleteOpen(true);
    setDeleteCounts(null);
    setDeleteError(null);
    setCountsLoading(true);
    try {
      const res = await fetch(`/api/superuser/admins/${admin.id}/counts`);
      if (res.status === 401) {
        router.push("/superuser/login");
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        setDeleteError(err.error || "Errore nel calcolo dei conteggi");
        return;
      }
      const data = await res.json();
      setDeleteCounts(data.counts);
    } catch {
      setDeleteError("Errore di rete nel calcolo dei conteggi");
    } finally {
      setCountsLoading(false);
    }
  }

  // Conferma finale: elimina l'azienda e torna alla dashboard
  async function handleConfirmDelete() {
    if (!admin) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/superuser/admins/${admin.id}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        router.push("/superuser/login");
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        setDeleteError(err.error || "Errore nell'eliminazione dell'azienda");
        setDeleting(false);
        return;
      }
      router.push("/superuser/dashboard");
    } catch {
      setDeleteError("Errore di rete durante l'eliminazione");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Admin non trovato</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/superuser/dashboard")}
        >
          Torna alla Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/superuser/dashboard")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Torna alla Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {admin.name}
            </h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{admin.email}</span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {admin.companyName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Regole Azienda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Regole Azienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Imposta i limiti per l&apos;azienda. Usa 0 per nessun limite.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxUsers">Max Utenti</Label>
              <Input
                id="maxUsers"
                type="number"
                min={0}
                value={formMaxUsers}
                onChange={(e) => setFormMaxUsers(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxClients">Max Clienti</Label>
              <Input
                id="maxClients"
                type="number"
                min={0}
                value={formMaxClients}
                onChange={(e) => setFormMaxClients(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTasks">Max Task</Label>
              <Input
                id="maxTasks"
                type="number"
                min={0}
                value={formMaxTasks}
                onChange={(e) => setFormMaxTasks(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Moduli Abilitati</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {FEATURE_OPTIONS.map((feat) => {
                const enabled = !!formFeatures[feat.key];
                return (
                  <button
                    key={feat.key}
                    type="button"
                    onClick={() => toggleFeature(feat.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      enabled
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background border-input text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {enabled ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 opacity-40" />
                    )}
                    {feat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Moduli Abilitati Admin</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {ADMIN_FEATURE_OPTIONS.map((feat) => {
                const enabled = !!formFeaturesAdmin[feat.key];
                return (
                  <button
                    key={feat.key}
                    type="button"
                    onClick={() => toggleAdminFeature(feat.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      enabled
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background border-input text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {enabled ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 opacity-40" />
                    )}
                    {feat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveRules} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Salva Regole
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabella Utenti */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              Utenti ({admin.users.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {admin.users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun utente in questa azienda
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Ruolo</th>
                    <th className="pb-3 font-medium">Stato</th>
                    <th className="pb-3 font-medium text-right">
                      Data Creazione
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {admin.users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-accent/50">
                      <td className="py-3 font-medium">{u.name}</td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            u.role === "admin" ? "default" : "secondary"
                          }
                        >
                          {u.role === "admin" ? "Admin" : "User"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={u.isActive ? "default" : "outline"}
                          className={
                            u.isActive
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "text-muted-foreground"
                          }
                        >
                          {u.isActive ? "Attivo" : "Disattivo"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("it-IT")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eliminazione Azienda */}
      <div className="flex justify-start pt-2">
        <Button
          variant="destructive"
          onClick={openDeleteDialog}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Elimina Azienda
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Elimina Azienda
            </AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare definitivamente l&apos;azienda{" "}
              <strong>{admin.companyName}</strong>. Tutti i dati collegati
              verranno cancellati in modo irreversibile. Questa azione non può
              essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border bg-muted/40 p-4">
            {countsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calcolo dati da eliminare...
              </div>
            ) : deleteCounts ? (
              <div className="space-y-1.5">
                {COUNT_LABELS.filter(
                  (c) => (deleteCounts[c.key] ?? 0) > 0
                ).map((c) => (
                  <div
                    key={c.key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-medium">{deleteCounts[c.key]}</span>
                  </div>
                ))}
                {Object.values(deleteCounts).every((n) => n === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Nessun dato collegato trovato.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {deleteError && !countsLoading && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting || countsLoading}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                "Elimina Definitivamente"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
