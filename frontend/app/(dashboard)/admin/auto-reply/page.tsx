"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { autoReplyRuleSchema, clientCategories } from "@/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface AutoReplyRule {
  id: string;
  categoria: string;
  templateId: string;
  templateName: string | null;
  followUpDays: number;
  followUpTaskTitle: string;
  enabled: boolean;
}

interface TemplateOption {
  id: string;
  name: string;
}

const DEFAULT_FORM = {
  categoria: "",
  templateId: "",
  followUpDays: "1",
  followUpTaskTitle: "Ricontattare cliente",
  enabled: true,
};

export default function AdminAutoReplyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authCheck, setAuthCheck] = useState<boolean | null>(null);
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<AutoReplyRule | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Solo gli amministratori possono accedere alla pagina
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user || data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setAuthCheck(true);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auto-reply-rules");
      if (res.status === 403) {
        toast({
          title: "Accesso negato",
          description: "Solo gli amministratori possono gestire le regole",
          variant: "destructive",
        });
        return;
      }
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile caricare le regole",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/email-templates");
      const data = await res.json();
      if (Array.isArray(data)) setTemplates(data);
    } catch {
      // Il select dei template resterà vuoto: l'errore è già gestito dalla lista
    }
  }, []);

  useEffect(() => {
    if (!authCheck) return;
    fetchRules();
    fetchTemplates();
  }, [authCheck, fetchRules, fetchTemplates]);

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setFormErrors({});
    setEditRule(null);
  };

  const openEdit = (rule: AutoReplyRule) => {
    setEditRule(rule);
    setFormData({
      categoria: rule.categoria,
      templateId: rule.templateId,
      followUpDays: String(rule.followUpDays),
      followUpTaskTitle: rule.followUpTaskTitle,
      enabled: rule.enabled,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = autoReplyRuleSchema.safeParse({
      categoria: formData.categoria,
      templateId: formData.templateId,
      followUpDays: Number(formData.followUpDays),
      followUpTaskTitle: formData.followUpTaskTitle,
      enabled: formData.enabled,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[String(issue.path[0])] = issue.message;
      });
      setFormErrors(errors);
      return;
    }

    try {
      const url = editRule
        ? `/api/admin/auto-reply-rules/${editRule.id}`
        : "/api/admin/auto-reply-rules";
      const res = await fetch(url, {
        method: editRule ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Errore",
          description: err.error || "Operazione fallita",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: editRule ? "Regola aggiornata" : "Regola creata",
        variant: "success" as any,
      });
      setModalOpen(false);
      resetForm();
      fetchRules();
    } catch {
      toast({
        title: "Errore",
        description: "Operazione fallita",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/auto-reply-rules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Errore",
          description: err.error || "Eliminazione fallita",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Regola eliminata", variant: "success" as any });
      fetchRules();
    } catch {
      toast({
        title: "Errore",
        description: "Eliminazione fallita",
        variant: "destructive",
      });
    }
  };

  if (authCheck === null || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Risposta automatica
          </h2>
          <p className="text-muted-foreground">
            Invia automaticamente un template ai nuovi contatti in base alla
            categoria
          </p>
        </div>
        <Dialog
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nuova regola
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editRule ? "Modifica regola" : "Nuova regola"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(val) =>
                    setFormData({ ...formData, categoria: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientCategories.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>
                        {categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.categoria && (
                  <p className="text-sm text-destructive">
                    {formErrors.categoria}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateId">Template</Label>
                <Select
                  value={formData.templateId}
                  onValueChange={(val) =>
                    setFormData({ ...formData, templateId: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        Nessun template disponibile
                      </SelectItem>
                    ) : (
                      templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {formErrors.templateId && (
                  <p className="text-sm text-destructive">
                    {formErrors.templateId}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUpDays">Follow-up (giorni)</Label>
                <Input
                  id="followUpDays"
                  type="number"
                  min={0}
                  value={formData.followUpDays}
                  onChange={(e) =>
                    setFormData({ ...formData, followUpDays: e.target.value })
                  }
                />
                {formErrors.followUpDays && (
                  <p className="text-sm text-destructive">
                    {formErrors.followUpDays}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUpTaskTitle">Titolo task ricontatto</Label>
                <Input
                  id="followUpTaskTitle"
                  value={formData.followUpTaskTitle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      followUpTaskTitle: e.target.value,
                    })
                  }
                />
                {formErrors.followUpTaskTitle && (
                  <p className="text-sm text-destructive">
                    {formErrors.followUpTaskTitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) =>
                    setFormData({ ...formData, enabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="enabled">Regola attiva</Label>
              </div>
              <Button type="submit" className="w-full">
                {editRule ? "Salva modifiche" : "Crea regola"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Regole configurate</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Follow-up (giorni)</TableHead>
                <TableHead>Attivo</TableHead>
                <TableHead className="w-[100px]">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Nessuna regola configurata
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.categoria}
                    </TableCell>
                    <TableCell>
                      {rule.templateName ?? "Template eliminato"}
                    </TableCell>
                    <TableCell>{rule.followUpDays}</TableCell>
                    <TableCell>
                      <Badge
                        variant={rule.enabled ? "default" : "outline"}
                        className={
                          rule.enabled
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : ""
                        }
                      >
                        {rule.enabled ? "Attivo" : "Disattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Elimina regola
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare la regola per la
                                categoria &quot;{rule.categoria}&quot;? Questa
                                azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(rule.id)}
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
