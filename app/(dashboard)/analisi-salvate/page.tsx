"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  BarChart3,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface SavedAnalysis {
  id: string;
  name: string;
  filters: {
    search?: string;
    status?: string;
    categoria?: string | string[];
    userId?: string | string[];
  };
  clientIds: string[];
  clientCount?: number;
  isDynamic?: boolean;
  createdAt: number;
}

export default function AnalisiSalvatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [tipoFiltro, setTipoFiltro] = useState<"tutte" | "dinamiche" | "fisse">("tutte");

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analyses");
      const data = await res.json();
      setAnalyses(Array.isArray(data) ? data : []);
    } catch {
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  useEffect(() => {
    // Mappa id → nome utente per il filtro "Assegnato a".
    // Prova prima /api/users/names (aperto a tutti); fallback /api/users (admin).
    const loadUsers = async (url: string) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return false;
        const json = await res.json();
        if (json.data) {
          const map: Record<string, string> = {};
          json.data.forEach((u: any) => {
            map[u.id] = u.name;
          });
          setUsersMap(map);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };
    (async () => {
      const ok = await loadUsers("/api/users/names");
      if (!ok) await loadUsers("/api/users");
    })();
  }, []);

  const buildExportUrl = (a: SavedAnalysis) => {
    const ids = Array.isArray(a.clientIds) ? a.clientIds : [];
    const params = new URLSearchParams();
    // Analisi dinamica (senza lista fissa): esporta i clienti correnti tramite i filtri salvati
    if (a.isDynamic || ids.length === 0) {
      const f = a.filters || {};
      if (f.search) params.set("search", f.search);
      if (f.status && f.status !== "all") params.set("status", f.status);
      const cat = Array.isArray(f.categoria) ? f.categoria : f.categoria ? [f.categoria] : [];
      for (const c of cat) params.append("categoria", c);
      const uids = Array.isArray(f.userId) ? f.userId : f.userId ? [f.userId] : [];
      for (const u of uids) params.append("userId", u);
    } else {
      // Analisi statica: esporta esattamente la lista fissata
      params.set("clientIds", ids.join(","));
    }
    return `/api/clients/export?${params.toString()}`;
  };

  const handleExport = (a: SavedAnalysis) => {
    const el = document.createElement("a");
    el.href = buildExportUrl(a);
    el.click();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Analisi eliminata", variant: "success" as any });
      fetchAnalyses();
    } catch {
      toast({
        title: "Errore",
        description: "Eliminazione fallita",
        variant: "destructive",
      });
    }
  };

  const filterLines = (a: SavedAnalysis) => {
    const f = a.filters || {};
    const fmt = (label: string, v?: string | string[]) => {
      if (!v) return null;
      const value = Array.isArray(v) ? v.filter(Boolean).join(", ") : v;
      return value ? `${label}: ${value}` : null;
    };
    // "Assegnato a": mostra i nomi utente (mappa id → nome, fallback all'id)
    const fmtAssignedTo = (v?: string | string[]) => {
      if (!v) return null;
      const ids = Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
      if (ids.length === 0) return null;
      const names = ids.map((id) => usersMap[id] || id);
      return `Assegnato a: ${names.join(", ")}`;
    };
    const lines = [
      f.search ? `Ricerca: "${f.search}"` : null,
      fmt("Status", f.status ? f.status.charAt(0).toUpperCase() + f.status.slice(1) : undefined),
      fmt("Categoria", f.categoria),
      fmtAssignedTo(f.userId),
    ].filter(Boolean) as string[];
    return lines;
  };

  // Filtro pagina: tutte / solo dinamiche / solo fisse
  const filtered = analyses.filter((a) => {
    if (tipoFiltro === "dinamiche") return !!a.isDynamic;
    if (tipoFiltro === "fisse") return !a.isDynamic;
    return true;
  });

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Analisi Salvate</h2>
            <p className="text-muted-foreground">
              Riapplica i filtri o esporta le analisi salvate
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={tipoFiltro}
              onValueChange={(v) => setTipoFiltro(v as "tutte" | "dinamiche" | "fisse")}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Tutte le analisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutte">Tutte</SelectItem>
                <SelectItem value="dinamiche">Solo dinamiche</SelectItem>
                <SelectItem value="fisse">Solo fisse</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={fetchAnalyses} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aggiorna</TooltipContent>
            </Tooltip>
            <Button variant="outline" onClick={() => router.push("/analisi")}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Nuova analisi
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Caricamento...</div>
        ) : analyses.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nessuna analisi salvata. Crea la prima dalla pagina{" "}
            <a href="/analisi" className="font-medium text-primary underline">Analisi</a>.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nessuna analisi per questo filtro.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex h-full flex-col p-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-[#2563eb]" title={a.name}>{a.name}</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Filtri applicati"
                          >
                            <Filter className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="start">
                          {filterLines(a).length > 0 ? (
                            <ul className="list-disc space-y-0.5 pl-4">
                              {filterLines(a).map((line, idx) => (
                                <li key={idx}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>Nessun filtro</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">
                        {a.clientCount ?? (Array.isArray(a.clientIds) ? a.clientIds.length : 0)}
                      </strong>{" "}
                      clienti
                      {a.isDynamic ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[#dbeafe] px-2 py-0.5 text-xs font-medium text-[#2563eb]">
                          Dinamica
                        </span>
                      ) : (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[#e2e8f0] px-2 py-0.5 text-xs font-medium text-[#475569]">
                          Fissa
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 border-t pt-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => handleExport(a)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Esporta i clienti salvati in Excel</TooltipContent>
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
                        <TooltipContent>Elimina analisi</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare questa analisi?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{a.name}" verrà eliminata definitivamente. I clienti salvati
                            non saranno cancellati.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(a.id)}>
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
