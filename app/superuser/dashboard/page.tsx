"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Shield,
  Loader2,
  Settings2,
  ExternalLink,
  Check,
  X,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
  createdAt: number;
}

interface CompanyRule {
  id: string;
  companyId: string;
  maxUsers: number;
  maxClients: number;
  maxTasks: number;
  features: Record<string, boolean>;
}

const FEATURE_OPTIONS = [
  { key: "email", label: "Email Integration" },
  { key: "taskManagement", label: "Task Management" },
  { key: "clientManagement", label: "Client Management" },
  { key: "noteManagement", label: "Note Management" },
  { key: "kanban", label: "Kanban Board" },
  { key: "calendar", label: "Calendar" },
];

export default function SuperuserDashboardPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [rulesMap, setRulesMap] = useState<Record<string, CompanyRule>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for rules
  const [formMaxUsers, setFormMaxUsers] = useState("0");
  const [formMaxClients, setFormMaxClients] = useState("0");
  const [formMaxTasks, setFormMaxTasks] = useState("0");
  const [formFeatures, setFormFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch("/api/superuser/admins");
      if (res.status === 401) {
        router.push("/superuser/login");
        return;
      }
      const data = await res.json();
      setAdmins(data);

      // Carica anche le regole
      const rulesRes = await fetch("/api/superuser/company-rules");
      const rulesData: CompanyRule[] = await rulesRes.json();
      const rulesMapData: Record<string, CompanyRule> = {};
      for (const rule of rulesData) {
        rulesMapData[rule.companyId] = rule;
      }
      setRulesMap(rulesMapData);
    } catch {
      router.push("/superuser/login");
    } finally {
      setLoading(false);
    }
  }

  function openRulesModal(admin: AdminUser) {
    setSelectedAdmin(admin);
    const existingRule = rulesMap[admin.companyId];
    setFormMaxUsers(String(existingRule?.maxUsers ?? 0));
    setFormMaxClients(String(existingRule?.maxClients ?? 0));
    setFormMaxTasks(String(existingRule?.maxTasks ?? 0));
    setFormFeatures(existingRule?.features ?? {});
    setModalOpen(true);
  }

  async function saveRules() {
    if (!selectedAdmin) return;
    setSaving(true);
    try {
      const res = await fetch("/api/superuser/company-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedAdmin.companyId,
          maxUsers: parseInt(formMaxUsers) || 0,
          maxClients: parseInt(formMaxClients) || 0,
          maxTasks: parseInt(formMaxTasks) || 0,
          features: formFeatures,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRulesMap((prev) => ({
          ...prev,
          [selectedAdmin.companyId]: updated,
        }));
        setModalOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleFeature(key: string) {
    setFormFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

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
        <h2 className="text-2xl font-bold tracking-tight">
          Dashboard Super Admin
        </h2>
        <p className="text-muted-foreground">
          Gestione di tutte le aziende e utenti del sistema
        </p>
      </div>

      {admins.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessun admin registrato
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Admin</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Azienda</th>
                <th className="pb-3 font-medium text-center">Regole</th>
                <th className="pb-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const rule = rulesMap[admin.companyId];
                const hasRules =
                  rule &&
                  (rule.maxUsers > 0 ||
                    rule.maxClients > 0 ||
                    rule.maxTasks > 0);
                return (
                  <tr
                    key={admin.id}
                    className="border-b hover:bg-accent/50 transition-colors group"
                  >
                    <td className="py-3">
                      <button
                        onClick={() =>
                          router.push(`/superuser/admin/${admin.id}`)
                        }
                        className="flex items-center gap-2 text-left"
                      >
                        <Shield className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium group-hover:text-primary transition-colors">
                          {admin.name}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {admin.email}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span>{admin.companyName}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      {hasRules ? (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          Configurati
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          Nessun limite
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRulesModal(admin)}
                      >
                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                        Regole
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Regole */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Regole per {selectedAdmin?.companyName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
              <Label>Funzionalità Abilitate</Label>
              <div className="grid grid-cols-2 gap-2">
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Annulla
            </Button>
            <Button onClick={saveRules} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                "Salva Regole"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
