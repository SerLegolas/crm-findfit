"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/components/ui/use-toast";
import {
  Ban,
  CalendarClock,
  Eye,
  Loader2,
  MailOpen,
  MailPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type Stato =
  | "programmata"
  | "in_elaborazione"
  | "inviata"
  | "inviata_parziale"
  | "fallita"
  | "annullata";

interface BatchStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

interface Comunicazione {
  id: string;
  titolo: string;
  templateId: string | null;
  analisiId: string | null;
  templateName?: string | null;
  analisiName?: string | null;
  dataInvio: number | string;
  stato: Stato;
  lock: boolean;
  batchStats?: BatchStats;
  createdAt: number | string;
  updatedAt: number | string;
}

interface Template {
  id: string;
  name: string;
}

interface Analisi {
  id: string;
  name: string;
  clientCount?: number;
  isDynamic?: boolean;
}

interface Invio {
  id: string;
  clientId: string;
  clienteNome: string | null;
  clienteEmail: string | null;
  stato: "pending" | "sent" | "failed";
  tentativi: number;
  errore: string | null;
  inviatoIl: number | string | null;
  createdAt: number | string;
  trackingId: string | null;
  consegnata: number | string | null;
  aperta: number | string | null;
}

const invioStatoConfig: Record<
  Invio["stato"],
  { label: string; variant: "success" | "destructive" | "muted" }
> = {
  sent: { label: "Inviata", variant: "success" },
  failed: { label: "Fallita", variant: "destructive" },
  pending: { label: "In attesa", variant: "muted" },
};

const statoConfig: Record<Stato, { label: string; variant: "info" | "warning" | "success" | "destructive" | "muted" | "secondary" }> = {
  programmata: { label: "Programmata", variant: "info" },
  in_elaborazione: { label: "In elaborazione", variant: "warning" },
  inviata: { label: "Inviata", variant: "success" },
  inviata_parziale: { label: "Inviata parziale", variant: "warning" },
  fallita: { label: "Fallita", variant: "destructive" },
  annullata: { label: "Annullata", variant: "muted" },
};

const parseTs = (value: number | string | Date): Date | null => {
  if (!value) return null;
  let d: Date;
  if (typeof value === "number") {
    d = new Date(value > 1e12 ? value : value * 1000);
  } else {
    d = new Date(value);
  }
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDateTime = (value: number | string) => {
  const d = parseTs(value);
  if (!d) return "—";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDateKey = (value: number | string | Date) => {
  const d = parseTs(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parseDateKey = (key: string): Date | null => {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export default function ComunicazioniPage() {
  const { toast } = useToast();

  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [analisiList, setAnalisiList] = useState<Analisi[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Comunicazione | null>(null);
  const [saving, setSaving] = useState(false);
  const [titolo, setTitolo] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [analisiId, setAnalisiId] = useState("");
  const [dataInvio, setDataInvio] = useState("");

  // Dettaglio invii
  const [inviiOpen, setInviiOpen] = useState(false);
  const [inviiComunicazione, setInviiComunicazione] = useState<Comunicazione | null>(null);
  const [invii, setInvii] = useState<Invio[]>([]);
  const [inviiLoading, setInviiLoading] = useState(false);
  const [inviiError, setInviiError] = useState<string | null>(null);

  const fetchComunicazioni = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/comunicazioni");
      const data = await res.json();
      setComunicazioni(Array.isArray(data) ? data : []);
    } catch {
      setComunicazioni([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComunicazioni();

    // Template e analisi per i selettori del form
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch("/api/analyses")
      .then((r) => r.json())
      .then((data) => setAnalisiList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetchComunicazioni]);

  // Date occupate (una comunicazione attiva al giorno): le date delle
  // comunicazioni non completate/annullate sono disabilitate nel picker.
  // La comunicazione in modifica esclude la propria data dal controllo.
  const occupiedDates = useMemo(() => {
    const map = new Map<string, Date>();
    for (const c of comunicazioni) {
      if (editing && c.id === editing.id) continue;
      if (c.stato === "inviata" || c.stato === "annullata") continue;
      const key = toDateKey(c.dataInvio);
      if (!key) continue;
      if (!map.has(key)) {
        const [y, m, d] = key.split("-").map(Number);
        map.set(key, new Date(y, m - 1, d));
      }
    }
    return Array.from(map.values());
  }, [comunicazioni, editing]);

  const openCreate = () => {
    setEditing(null);
    setTitolo("");
    setTemplateId("");
    setAnalisiId("");
    setDataInvio("");
    setDialogOpen(true);
  };

  const openEdit = (c: Comunicazione) => {
    setEditing(c);
    setTitolo(c.titolo);
    setTemplateId(c.templateId || "");
    setAnalisiId(c.analisiId || "");
    setDataInvio(toDateKey(c.dataInvio));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!titolo.trim()) {
      toast({ title: "Errore", description: "Il titolo è obbligatorio", variant: "destructive" });
      return;
    }
    if (!templateId) {
      toast({ title: "Errore", description: "Seleziona un template", variant: "destructive" });
      return;
    }
    if (!analisiId) {
      toast({ title: "Errore", description: "Seleziona un'analisi", variant: "destructive" });
      return;
    }
    if (!dataInvio) {
      toast({ title: "Errore", description: "Imposta la data di invio", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titolo: titolo.trim(),
        templateId,
        analisiId,
        // Solo la data (YYYY-MM-DD); l'ora viene decisa dal server in base all'ambiente
        dataInvio,
      };

      const res = editing
        ? await fetch(`/api/comunicazioni/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/comunicazioni", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Errore", description: json.error || "Salvataggio fallito", variant: "destructive" });
        return;
      }

      toast({
        title: editing ? "Comunicazione aggiornata" : "Comunicazione programmata",
        variant: "success" as any,
      });
      setDialogOpen(false);
      fetchComunicazioni();
    } catch {
      toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/comunicazioni/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eliminazione fallita");
      toast({ title: "Comunicazione eliminata", variant: "success" as any });
      fetchComunicazioni();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message || "Eliminazione fallita", variant: "destructive" });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/comunicazioni/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato: "annullata" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Annullamento fallito");
      toast({ title: "Comunicazione annullata", variant: "success" as any });
      fetchComunicazioni();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message || "Annullamento fallito", variant: "destructive" });
    }
  };

  const canEdit = (c: Comunicazione) =>
    !c.lock && c.stato !== "inviata" && c.stato !== "inviata_parziale";

  const openInvii = async (c: Comunicazione) => {
    setInviiComunicazione(c);
    setInviiOpen(true);
    setInvii([]);
    setInviiError(null);
    setInviiLoading(true);
    try {
      const res = await fetch(`/api/comunicazioni/${c.id}/invii`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore nel caricamento");
      setInvii(Array.isArray(json.invii) ? json.invii : []);
    } catch (e: any) {
      setInviiError(e.message || "Errore nel caricamento degli invii");
    } finally {
      setInviiLoading(false);
    }
  };

  const riepilogo = (c: Comunicazione) => {
    const s = c.batchStats;
    if (!s || s.total === 0) return null;
    return s;
  };

  return (
    <div className="space-y-6">
      {/* Intestazione */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Comunicazioni</h2>
          <p className="text-muted-foreground">
            Programa l'invio di un template a un'analisi: il cron esterno le invierà in automatico
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchComunicazioni} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aggiorna
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuova Comunicazione
          </Button>
        </div>
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Analisi</TableHead>
                <TableHead>Data invio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Riepilogo</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : comunicazioni.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <MailPlus className="h-8 w-8 text-muted-foreground/50" />
                      <p>Nessuna comunicazione programmata.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                comunicazioni.map((c) => {
                  const cfg = statoConfig[c.stato];
                  const editable = canEdit(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.titolo}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.templateName || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.analisiName || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatDateTime(c.dataInvio)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="font-medium">
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const s = riepilogo(c);
                          if (!s) return <span className="text-sm text-muted-foreground">—</span>;
                          return (
                            <div className="text-sm">
                              <div className="font-medium text-foreground">
                                Inviati: {s.sent}/{s.total}
                              </div>
                              {s.failed > 0 && (
                                <div className="text-destructive">Falliti: {s.failed}</div>
                              )}
                              {s.pending > 0 && (
                                <div className="text-muted-foreground">In attesa: {s.pending}</div>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openInvii(c)}
                            title="Dettaglio invii"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {editable && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {c.stato === "programmata" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancel(c.id)}
                                  title="Annulla comunicazione"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminare la comunicazione?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Verranno eliminate anche le relative righe di invio. L'azione non è reversibile.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(c.id)}>
                                      Elimina
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          {!editable && c.stato !== "annullata" && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog crea/modifica */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica Comunicazione" : "Nuova Comunicazione"}
            </DialogTitle>
            <DialogDescription>
              Seleziona template e analisi. L'invio avverrà automaticamente alla data scelta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titolo">Titolo</Label>
              <Input
                id="titolo"
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                placeholder="Es. Promozione estiva"
              />
            </div>

            <div className="space-y-2">
              <Label>Template email</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Analisi</Label>
              <Select value={analisiId} onValueChange={setAnalisiId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un'analisi" />
                </SelectTrigger>
                <SelectContent>
                  {analisiList.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {typeof a.clientCount === "number" ? ` (${a.clientCount} clienti)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data di invio</Label>
              <DatePicker
                selected={dataInvio ? parseDateKey(dataInvio) : null}
                onChange={(d: Date | null) => setDataInvio(d ? toDateKey(d) : "")}
                dateFormat="dd/MM/yyyy"
                placeholderText="Seleziona una data"
                excludeDates={occupiedDates}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                showYearDropdown
                dropdownMode="select"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Le email verranno spedite automaticamente alle 08:00 del giorno selezionato.
              </p>
              {process.env.NODE_ENV !== "production" && (
                <a
                  href="http://localhost:3000/api/cron/send-communications?secret=65bd6189f2797d3d37229f3cf58a8f2c5e15d9cceba4f306"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-blue-600 underline mt-1"
                >
                  Esegui invio manuale (cron)
                </a>
              )}
              {occupiedDates.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Le date con una comunicazione già attiva sono disabilitate.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Salva modifiche" : "Programma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog dettaglio invii */}
      <Dialog open={inviiOpen} onOpenChange={setInviiOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailOpen className="h-5 w-5 text-primary" />
              Dettaglio invii
            </DialogTitle>
            <DialogDescription>
              {inviiComunicazione?.titolo || ""} — invii effettuati e stato di lettura
            </DialogDescription>
          </DialogHeader>

          {inviiLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : inviiError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {inviiError}
            </div>
          ) : invii.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <MailPlus className="h-8 w-8 text-muted-foreground/50" />
              <p>Nessun invio registrato per questa comunicazione.</p>
              <p className="text-xs">Gli invii vengono generati dal cron alla data programmata.</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data/ora invio</TableHead>
                    <TableHead>Consegnata</TableHead>
                    <TableHead>Aperta</TableHead>
                    <TableHead>Errore</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invii.map((inv) => {
                    const cfg = invioStatoConfig[inv.stato];
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.clienteNome || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {inv.clienteEmail || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="font-medium">
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {inv.inviatoIl ? formatDateTime(inv.inviatoIl) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {inv.consegnata ? formatDateTime(inv.consegnata) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {inv.aperta ? (
                            <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                              <MailOpen className="h-3.5 w-3.5" />
                              {formatDateTime(inv.aperta)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {inv.errore ? (
                            <span
                              className="block truncate text-xs text-destructive"
                              title={inv.errore}
                            >
                              {inv.errore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviiOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
