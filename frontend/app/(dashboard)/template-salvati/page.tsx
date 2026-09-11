"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  CalendarDays,
  Eye,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  footerImageUrl?: string | null;
  author: string;
  createdAt: number | string;
  updatedAt: number | string;
}

export default function TemplateSalvatiPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-templates");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Ruolo utente: il filtro per autore è visibile solo agli admin
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) setIsAdmin(json.user.role === "admin");
      })
      .catch(() => {});
  }, []);

  const formatDate = (value: number | string) => {
    if (!value) return "—";
    let d: Date;
    if (typeof value === "number") {
      d = new Date(value > 1e12 ? value : value * 1000);
    } else {
      d = new Date(value);
    }
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Elenco autori unici per il filtro (solo admin)
  const uniqueAuthors = useMemo(
    () => Array.from(new Set(templates.map((t) => t.author).filter(Boolean))),
    [templates]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q);
      const matchesAuthor = authorFilter === "all" || t.author === authorFilter;
      return matchesSearch && matchesAuthor;
    });
  }, [templates, search, authorFilter]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/email-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Template eliminato", variant: "success" as any });
      fetchTemplates();
    } catch {
      toast({
        title: "Errore",
        description: "Eliminazione fallita",
        variant: "destructive",
      });
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Intestazione */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Template Salvati</h2>
            <p className="text-muted-foreground">
              Gestisci i modelli di email: visualizza, modifica o elimina
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome o oggetto..."
                className="h-9 w-64 pl-9"
              />
            </div>
            {isAdmin && uniqueAuthors.length > 0 && (
              <Select value={authorFilter} onValueChange={setAuthorFilter}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="Tutti gli autori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli autori</SelectItem>
                  {uniqueAuthors.map((author) => (
                    <SelectItem key={author} value={author}>
                      {author}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchTemplates}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aggiorna</TooltipContent>
            </Tooltip>
            <Link href="/template-nuovo">
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Nuovo template
              </Button>
            </Link>
          </div>
        </div>

        {/* Stati */}
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Caricamento...
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nessun template salvato. Crea il primo dalla pagina{" "}
            <Link href="/template-nuovo" className="font-medium text-primary underline">
              Nuovo Template
            </Link>
            .
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nessun template corrisponde alla ricerca o al filtro selezionato.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <Card key={t.id} className="overflow-hidden shadow-sm">
                <CardContent className="flex h-full flex-col p-5">
                  {/* Intestazione card */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe]">
                        <FileText className="h-5 w-5 text-[#2563eb]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate font-medium text-[#2563eb]"
                          title={t.name}
                        >
                          {t.name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground" title={t.subject}>
                          Oggetto: <span className="text-slate-600">{t.subject}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.author || "—"}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      Creato il {formatDate(t.createdAt)}
                    </p>
                    {t.footerImageUrl && (
                      <p className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50 text-[10px] text-blue-700"
                        >
                          Footer immagine
                        </Badge>
                      </p>
                    )}
                  </div>

                  {/* Azioni */}
                  <div className="mt-4 flex items-center gap-1 border-t pt-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/template-nuovo?id=${t.id}`}>
                          <Button variant="outline" size="sm">
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Modifica
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Modifica template</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/template-anteprima/${t.id}`}>
                          <Button variant="outline" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Anteprima template</TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="ml-auto">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Elimina template</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare questo template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{t.name}" verrà eliminato definitivamente. Questa azione è
                            irreversibile.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(t.id)}>
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
      </div>
    </TooltipProvider>
  );
}
