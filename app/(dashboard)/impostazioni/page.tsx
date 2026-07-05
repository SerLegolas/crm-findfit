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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Save,
  User,
  Lock,
  Building2,
  Pencil,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import HtmlEditor from "@/components/html-editor";
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

type Tab = "generali" | "utente" | "azienda" | "template_email";

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

export default function ImpostazioniPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("generali");

  // Utente loggato
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  // Cambio password
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

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

  // Template email
  interface Template {
    id: string;
    name: string;
    subject: string;
    bodyHtml: string;
    author: string;
    createdAt: number;
    updatedAt: number;
  }

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", subject: "", bodyHtml: "" });
  const [currentUserName, setCurrentUserName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/email-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch {
      // silent
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "template_email") fetchTemplates();
  }, [activeTab]);

  const openNewTemplate = () => {
    setEditTemplate(null);
    setTemplateForm({ name: "", subject: "", bodyHtml: "" });
    setTemplateDialogOpen(true);
  };

  useEffect(() => {
    if (user?.name) setCurrentUserName(user.name);
  }, [user]);

  const openEditTemplate = (tmpl: Template) => {
    setEditTemplate(tmpl);
    setTemplateForm({
      name: tmpl.name,
      subject: tmpl.subject,
      bodyHtml: tmpl.bodyHtml,
    });
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.subject.trim() || !templateForm.bodyHtml.trim()) {
      toast({ title: "Errore", description: "Tutti i campi sono obbligatori", variant: "destructive" });
      return;
    }

    setSavingTemplate(true);
    try {
      const url = editTemplate
        ? `/api/email-templates/${editTemplate.id}`
        : "/api/email-templates";
      const method = editTemplate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error || "Operazione fallita", variant: "destructive" });
        return;
      }

      toast({
        title: editTemplate ? "Template aggiornato" : "Template creato",
        variant: "success" as any,
      });
      setTemplateDialogOpen(false);
      fetchTemplates();
    } catch {
      toast({ title: "Errore", description: "Errore durante il salvataggio", variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/email-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Template eliminato", variant: "success" as any });
      fetchTemplates();
    } catch {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) setUser(json.user);
      })
      .catch(() => {});
  }, []);

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
    if (activeTab === "azienda" || activeTab === "generali") fetchCompany();
  }, [activeTab]);

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

  const tabs: { key: Tab; label: string }[] = [
    { key: "generali", label: "Generali" },
    { key: "utente", label: "Utente" },
    { key: "azienda", label: "Azienda" },
    { key: "template_email", label: "Template Email" },
  ];

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

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Impostazioni</h2>
        <p className="text-muted-foreground">
          Configurazione del sistema CRM
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.key === "generali" && <User className="h-4 w-4" />}
              {tab.key === "utente" && <Lock className="h-4 w-4" />}
              {tab.key === "azienda" && <Building2 className="h-4 w-4" />}
              {tab.key === "template_email" && <FileText className="h-4 w-4" />}
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* TAB: Generali */}
      {activeTab === "generali" && (
        <div className="grid gap-6">
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
      )}

      {/* TAB: Utente */}
      {activeTab === "utente" && (
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
      )}

      {/* TAB: Azienda */}
      {activeTab === "azienda" && (
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
      )}

      {/* TAB: Template Email */}
      {activeTab === "template_email" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">Template Email</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="default" size="icon" onClick={openNewTemplate}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nuovo template</TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun template. Creane uno nuovo.</p>
            ) : (
              <div className="space-y-3">
                {templates.map((tmpl) => (
                  <Card key={tmpl.id}>
                    <CardContent className="flex items-start justify-between py-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{tmpl.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Oggetto: {tmpl.subject}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Autore: {tmpl.author}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {tmpl.bodyHtml.replace(/<[^>]+>/g, "")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-4 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openEditTemplate(tmpl)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modifica</TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Elimina</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare questo template?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Questa azione è irreversibile.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTemplate(tmpl.id)}>
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog creazione/modifica template */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Modifica template" : "Nuovo template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome</Label>
              <Input
                id="template-name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="Nome del template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-subject">Oggetto</Label>
              <Input
                id="template-subject"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                placeholder="Oggetto dell'email"
              />
            </div>
            <div className="space-y-2">
              <HtmlEditor
                id="template-body"
                label="Corpo HTML"
                value={templateForm.bodyHtml}
                onChange={(value) => setTemplateForm({ ...templateForm, bodyHtml: value })}
                placeholder="Scrivi il contenuto HTML dell'email..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={savingTemplate}>
                {savingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTemplate ? "Salva" : "Crea template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                  value={editForm[key] || ""}
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
