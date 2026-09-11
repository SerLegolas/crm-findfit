"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import {
  clientStatuses,
  type ClientStatus,
} from "@/types";
import { formatDate } from "@/lib/utils";
import {
  Search,
  Filter,
  Download,
  Loader2,
  Save,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: ClientStatus;
  categoria: string | null;
  userId: string | null;
  createdAt: number;
}

export default function AnalisiPage() {
  const { toast } = useToast();

  // Filtri (inizializzati dai parametri URL per "riapplica filtri")
  const [filters, setFilters] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return {
        search: params.get("search") || "",
        status: params.get("status") || "",
        categoria: (params.get("categoria") || "").split(",").filter(Boolean),
        userId: (params.get("userId") || "").split(",").filter(Boolean),
      };
    }
    return { search: "", status: "", categoria: [] as string[], userId: [] as string[] };
  });
  const [searchInput, setSearchInput] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("search") || "";
    }
    return "";
  });

  // Dati
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Salvataggio analisi
  const [analysisName, setAnalysisName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Utente corrente e ruolo: determinano il comportamento del filtro "Assegnato a"
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const isAdmin = currentUser?.role === "admin";

  // Previene setState dopo lo smontaggio del componente
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Contatore richieste in sospeso per un loading "atomico":
  // loading resta true finché TUTTE le richieste iniziali non sono complete.
  const pendingRequests = useRef(0);
  const beginRequest = useCallback(() => {
    pendingRequests.current += 1;
    setLoading(true);
  }, []);
  const endRequest = useCallback(() => {
    pendingRequests.current = Math.max(0, pendingRequests.current - 1);
    if (pendingRequests.current === 0 && isMounted.current) {
      setLoading(false);
    }
  }, []);

  // fetchClients NON tocca loading quando è in modalità "silent" (cambi filtro),
  // così la lista non lampeggia: il loading è gestito dal contatore solo nel
  // caricamento iniziale (Promise.all).
  const fetchClients = useCallback(async (silent = false) => {
    if (!silent) beginRequest();
    try {
      const params = new URLSearchParams({
        limit: "500",
        sort: "createdAt",
        order: "desc",
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      for (const c of filters.categoria) params.append("categoria", c);
      for (const uid of filters.userId) params.append("userId", uid);

      const res = await fetch(`/api/clients?${params}`);
      const data = await res.json();
      if (!isMounted.current) return;
      setClients(Array.isArray(data?.data) ? data.data : []);
      setTotal(data?.total ?? 0);
    } catch {
      if (!isMounted.current) return;
      setClients([]);
      setTotal(0);
    } finally {
      if (!silent) endRequest();
    }
  }, [filters, beginRequest, endRequest]);

  // Mappa utenti (colonna "Assegnato a" e filtro).
  // Prova prima /api/users/names (aperto a tutti); fallback /api/users (admin).
  const fetchUsers = useCallback(async () => {
    beginRequest();
    try {
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
            if (isMounted.current) setUsersMap(map);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      };
      const ok = await loadUsers("/api/users/names");
      if (!ok) await loadUsers("/api/users");
    } finally {
      endRequest();
    }
  }, [beginRequest, endRequest]);

  // Opzioni categoria per il multiselect
  const fetchCategories = useCallback(async () => {
    beginRequest();
    try {
      const res = await fetch("/api/clients/categories");
      const data = await res.json();
      if (Array.isArray(data?.categories) && isMounted.current) {
        setCategories(data.categories);
      }
    } catch {
      // silenzioso
    } finally {
      endRequest();
    }
  }, [beginRequest, endRequest]);

  // Caricamento iniziale: clienti, utenti e categorie in parallelo.
  // Il loading è gestito dal contatore pendingRequests (false solo a 0).
  const loadInitialData = useCallback(async () => {
    await Promise.all([fetchClients(), fetchUsers(), fetchCategories()]);
  }, [fetchClients, fetchUsers, fetchCategories]);

  // Mount: carica tutto una sola volta (clienti, utenti, categorie).
  // I cambi filtro sono gestiti dall'effect su fetchClients qui sotto.
  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch clienti quando i filtri cambiano.
  // Il primo fetch è già eseguito da loadInitialData → viene saltato.
  // silent=true: non tocca loading, così la lista non lampeggia sui cambi filtro.
  const skipFirstClientsFetch = useRef(true);
  useEffect(() => {
    if (skipFirstClientsFetch.current) {
      skipFirstClientsFetch.current = false;
      return;
    }
    fetchClients(true);
  }, [fetchClients]);

  // Recupera l'utente corrente per gestire il filtro "Assegnato a" in base al ruolo
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          setCurrentUser({
            id: data.user.id,
            name: data.user.name,
            role: data.user.role,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Gli utenti "user" vedono SOLO i propri clienti: forza il filtro "Assegnato a"
  // sul proprio ID (il server filtra comunque per company + userId).
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      setFilters((f) => ({
        ...f,
        userId: [currentUser.id],
      }));
    }
  }, [currentUser]);

  // ── Selezione ──
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = clients.length > 0 && clients.every((c) => selected.has(c.id));
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(clients.map((c) => c.id)));
  };

  // ── Salva analisi ──
  // Se non selezioni clienti specifici, l'analisi è DINAMICA (clientIds vuoto):
  // conteggio ed export useranno i filtri salvati al posto di uno snapshot statico.
  const saveClientIds = Array.from(selected);

  const handleSave = async () => {
    if (!analysisName.trim()) {
      toast({ title: "Errore", description: "Inserisci un nome per l'analisi", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: analysisName.trim(),
          filters,
          clientIds: saveClientIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error || "Salvataggio fallito", variant: "destructive" });
        return;
      }

      toast({ title: "Analisi salvata", variant: "success" as any });
      setAnalysisName("");
      setSaveDialogOpen(false);
    } catch {
      toast({ title: "Errore", description: "Salvataggio fallito", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Esporta Excel ──
  const buildExportUrl = () => {
    const params = new URLSearchParams();
    if (selected.size > 0) {
      params.set("clientIds", Array.from(selected).join(","));
    } else {
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      for (const c of filters.categoria) params.append("categoria", c);
      for (const uid of filters.userId) params.append("userId", uid);
    }
    return `/api/clients/export?${params}`;
  };

  const handleExport = () => {
    const a = document.createElement("a");
    a.href = buildExportUrl();
    a.click();
  };

  const applySearch = () => {
    setFilters((f) => ({ ...f, search: searchInput }));
  };

  const updateFilter = (key: keyof typeof filters, value: any) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Analisi</h2>
            <p className="text-muted-foreground">
              Filtra, seleziona e salva i clienti come analisi riutilizzabili
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setSaveDialogOpen(true)} disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  Salva
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {selected.size > 0
                  ? `Salva i ${selected.size} clienti selezionati`
                  : "Salva tutti i clienti filtrati"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleExport} disabled={loading}>
                  <Download className="mr-2 h-4 w-4" />
                  Esporta Excel
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {selected.size > 0
                  ? "Esporta i clienti selezionati"
                  : "Esporta tutti i clienti filtrati"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filtri */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Filtri</CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              aria-label={filtersOpen ? "Comprimi filtri" : "Espandi filtri"}
            >
              {filtersOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {filtersOpen && (
            <CardContent className="space-y-4">
            {/* Anagrafici */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anagrafici
              </Label>
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per nome, email o azienda..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applySearch()}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="secondary" onClick={applySearch}>
                    Cerca
                  </Button>
                  <Select
                    value={filters.status}
                    onValueChange={(v) => updateFilter("status", v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Tutti gli status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      {clientStatuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between gap-2"
                      >
                        <span className="min-w-0 truncate text-sm text-muted-foreground">
                          Categoria...
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
                      <DropdownMenuLabel>Categorie</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {categories.length === 0 ? (
                        <DropdownMenuLabel className="font-normal text-muted-foreground">
                          Nessuna categoria disponibile
                        </DropdownMenuLabel>
                      ) : (
                        categories.map((c) => (
                          <DropdownMenuCheckboxItem
                            key={c}
                            checked={filters.categoria.includes(c)}
                            onCheckedChange={(checked) =>
                              setFilters((prev) => ({
                                ...prev,
                                categoria: checked
                                  ? [...prev.categoria, c]
                                  : prev.categoria.filter((x) => x !== c),
                              }))
                            }
                          >
                            {c}
                          </DropdownMenuCheckboxItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {filters.categoria.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {filters.categoria.map((c) => (
                        <Badge key={c} variant="secondary" className="text-xs">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-full">
                  {currentUser === null ? (
                    // In attesa del caricamento del profilo (evita flash del dropdown)
                    <div className="flex h-10 items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Caricamento profilo...</span>
                    </div>
                  ) : isAdmin ? (
                    // Admin: dropdown completo con tutti gli utenti e "Non assegnato"
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between gap-2"
                          >
                            <span className="min-w-0 truncate text-sm text-muted-foreground">
                              Assegnato a...
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
                          <DropdownMenuLabel>Assegnato a</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                            checked={filters.userId.includes("__none__")}
                            onCheckedChange={(checked) =>
                              setFilters((prev) => ({
                                ...prev,
                                userId: checked
                                  ? [...prev.userId, "__none__"]
                                  : prev.userId.filter((x) => x !== "__none__"),
                              }))
                            }
                          >
                            Non assegnato
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          {Object.keys(usersMap).length === 0 ? (
                            <DropdownMenuLabel className="font-normal text-muted-foreground">
                              Nessun utente disponibile
                            </DropdownMenuLabel>
                          ) : (
                            Object.entries(usersMap).map(([id, name]) => (
                              <DropdownMenuCheckboxItem
                                key={id}
                                checked={filters.userId.includes(id)}
                                onCheckedChange={(checked) =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    userId: checked
                                      ? [...prev.userId, id]
                                      : prev.userId.filter((x) => x !== id),
                                  }))
                                }
                              >
                                {name}
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {filters.userId.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {filters.userId.map((id) => (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {id === "__none__" ? "Non assegnato" : usersMap[id] || id}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    // Utente "user": filtro bloccato sul proprio nome, con lucchetto
                    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2">
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Assegnato a:{" "}
                        <strong className="text-foreground">
                          {usersMap[currentUser?.id || ""] || currentUser?.name || "..."}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Lista clienti */}
        <div className="rounded-md border">
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {allSelected ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Seleziona tutti</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email / Telefono</TableHead>
                  <TableHead className="hidden sm:table-cell">Azienda</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden md:table-cell">Assegnato a</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Nessun cliente trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow
                      key={client.id}
                      className={selected.has(client.id) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(client.id)}
                          onChange={() => toggleSelect(client.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{client.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Creato il {formatDate(client.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{client.email || "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {client.phone || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {client.company || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {client.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {client.categoria || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {client.userId && usersMap[client.userId]
                          ? usersMap[client.userId]
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {total > 500 && (
          <p className="text-sm text-muted-foreground">
            Mostrati 500 clienti su {total} totali
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {selected.size > 0
            ? `${selected.size} clienti selezionati`
            : "Nessun cliente selezionato — le azioni agiranno su tutti i filtri"}
        </p>

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Salva analisi</DialogTitle>
              <DialogDescription>
                Dai un nome all'analisi per ritrovarla tra le analisi salvate.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="analysisName">Nome analisi</Label>
              <Input
                id="analysisName"
                placeholder="es. Clienti won senza categoria..."
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salva
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
