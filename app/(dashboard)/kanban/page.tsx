"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { clientStatuses, allowedTransitions, requiresNoteForTransition, type ClientStatus } from "@/types";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  status: ClientStatus;
  userId: string | null;
}

const columns: { id: ClientStatus; title: string; bgClass: string }[] = [
  { id: "lead", title: "Lead", bgClass: "bg-blue-50" },
  { id: "suspect", title: "Suspect", bgClass: "bg-yellow-50" },
  { id: "won", title: "Won", bgClass: "bg-green-50" },
  { id: "closed_lost", title: "Closed Lost", bgClass: "bg-gray-50" },
];

export default function KanbanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignedToFilter, setAssignedToFilter] = useState("all");

  // Dati per colonna (paginazione): pagina corrente, clienti mostrati, totale e loading.
  // Ogni colonna ha il proprio stato di pagina (default 1).
  type ColumnData = { page: number; items: Client[]; total: number; loading: boolean };
  const [columnsData, setColumnsData] = useState<Record<ClientStatus, ColumnData>>({
    lead: { page: 1, items: [], total: 0, loading: true },
    suspect: { page: 1, items: [], total: 0, loading: true },
    won: { page: 1, items: [], total: 0, loading: true },
    closed_lost: { page: 1, items: [], total: 0, loading: true },
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) {
          setCurrentUserId(json.user.id);
          setIsAdmin(json.user.role === "admin");
        }
      })
      .catch(() => {});

    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const map: Record<string, string> = {};
          const list: { id: string; name: string }[] = [];
          json.data.forEach((u: any) => {
            map[u.id] = u.name;
            list.push({ id: u.id, name: u.name });
          });
          setUsersMap(map);
          setUsersList(list);
        }
      })
      .catch(() => {});
  }, []);

  // Close transition modal state
  const [closeModal, setCloseModal] = useState<{
    clientId: string;
    currentStatus: ClientStatus;
  } | null>(null);
  const [closeNote, setCloseNote] = useState("");

  // Carica una singola colonna (status) alla pagina indicata.
  // Se il filtro "Assegnato a" è attivo, il filtro è applicato dal server (userId).
  const fetchColumn = useCallback(
    async (status: ClientStatus, page: number) => {
      setColumnsData((prev) => ({
        ...prev,
        [status]: { ...prev[status], loading: true },
      }));
      try {
        const params = new URLSearchParams({
          status,
          page: String(page),
          limit: "20",
        });
        if (assignedToFilter !== "all") params.set("userId", assignedToFilter);
        const res = await fetch(`/api/clients?${params}`);
        const data = await res.json();
        setColumnsData((prev) => ({
          ...prev,
          [status]: {
            page,
            items: Array.isArray(data?.data) ? data.data : [],
            total: data?.total ?? 0,
            loading: false,
          },
        }));
      } catch {
        toast({
          title: "Errore",
          description: "Impossibile caricare i clienti",
          variant: "destructive",
        });
        setColumnsData((prev) => ({
          ...prev,
          [status]: { ...prev[status], loading: false },
        }));
      }
    },
    [assignedToFilter, toast]
  );

  // Carica tutte le colonne (pagina 1) in parallelo
  const loadAllColumns = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all(columns.map((col) => fetchColumn(col.id, 1)));
    } finally {
      setLoading(false);
    }
  }, [fetchColumn]);

  // Mount + cambio filtro "Assegnato a": ricarica tutte le colonne alla pagina 1
  useEffect(() => {
    loadAllColumns();
  }, [loadAllColumns]);

  const performCloseTransition = async () => {
    if (!closeModal) return;
    if (!closeNote.trim()) {
      toast({
        title: "Nota obbligatoria",
        description: "Inserisci una nota di motivazione per la chiusura",
        variant: "destructive",
      });
      return;
    }

    const { clientId, currentStatus } = closeModal;
    const sourcePage = columnsData[currentStatus].page;
    const closedPage = columnsData.closed_lost.page;

    // Optimistic: rimuovi il cliente dalla colonna di partenza
    setColumnsData((prev) => ({
      ...prev,
      [currentStatus]: {
        ...prev[currentStatus],
        items: prev[currentStatus].items.filter((c) => c.id !== clientId),
      },
    }));
    setCloseModal(null);
    setCloseNote("");

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed_lost", noteContent: closeNote.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({
        title: "Errore",
        description: "Transizione fallita",
        variant: "destructive",
      });
    } finally {
      // Ricarica la colonna di partenza e la colonna closed_lost
      fetchColumn(currentStatus, sourcePage);
      fetchColumn("closed_lost", closedPage);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    const newStatus = destination.droppableId as ClientStatus;
    const currentStatus = source.droppableId as ClientStatus;

    // Check if transition is allowed
    const allowed = allowedTransitions[currentStatus];
    if (!allowed.includes(newStatus)) {
      toast({
        title: "Transizione non consentita",
        description: `Da "${currentStatus}" a "${newStatus}" non è permessa`,
        variant: "destructive",
      });
      return;
    }

    // Intercept close transitions that require a note
    if (requiresNoteForTransition(currentStatus, newStatus)) {
      setCloseModal({ clientId: draggableId, currentStatus });
      setCloseNote("");
      return;
    }

    const sourcePage = columnsData[currentStatus].page;
    const destPage = columnsData[newStatus].page;

    // Optimistic: rimuovi il cliente dalla colonna di partenza
    setColumnsData((prev) => ({
      ...prev,
      [currentStatus]: {
        ...prev[currentStatus],
        items: prev[currentStatus].items.filter((c) => c.id !== draggableId),
      },
    }));

    try {
      const res = await fetch(`/api/clients/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({
        title: "Errore",
        description: "Transizione fallita",
        variant: "destructive",
      });
    } finally {
      // Ricarica la colonna di partenza e di destinazione (paginazione corretta)
      fetchColumn(currentStatus, sourcePage);
      fetchColumn(newStatus, destPage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  // Filtro "Assegnato a" (solo admin): applicato dal server nelle richieste per colonna.
  // Al cambio del filtro le pagine tornano a 1 e tutte le colonne si ricaricano.

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trattative</h2>
          <p className="text-muted-foreground">
            Trascina i clienti tra le colonne per aggiornare lo status
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Label
              htmlFor="assigned-to-filter"
              className="whitespace-nowrap text-sm text-muted-foreground"
            >
              Assegnato a
            </Label>
            <Select
              value={assignedToFilter}
              onValueChange={setAssignedToFilter}
            >
              <SelectTrigger id="assigned-to-filter" className="w-full sm:w-48">
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {usersList.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => {
            const colData = columnsData[column.id];
            const totalPages = Math.max(1, Math.ceil(colData.total / 20));

            return (
              <div key={column.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {colData.total}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] rounded-lg border-2 border-dashed p-3 space-y-3 transition-colors ${column.bgClass} ${
                        snapshot.isDraggingOver
                          ? "border-primary bg-primary/10"
                          : "border-muted"
                      }`}
                    >
                      {colData.items.length === 0 && !colData.loading && !snapshot.isDraggingOver && (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          Nessun cliente
                        </p>
                      )}
                      {colData.loading && (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          Caricamento...
                        </p>
                      )}

                      {colData.items.map((client, index) => (
                        <Draggable
                          key={client.id}
                          draggableId={client.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...(provided.draggableProps as any)}
                              {...(provided.dragHandleProps as any)}
                              onClick={() => router.push(`/clienti/${client.id}`)}
                              className={`rounded-lg border bg-card text-card-foreground shadow-sm p-3 cursor-pointer hover:bg-accent/50 relative ${
                                snapshot.isDragging
                                  ? "shadow-lg ring-2 ring-primary"
                                  : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {client.name || client.company}
                                  </p>
                                  {client.name && client.company && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {client.company}
                                    </p>
                                  )}
                                  {client.phone && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {client.phone}
                                    </p>
                                  )}
                                </div>
                                {client.userId && usersMap[client.userId] && (
                                  <div
                                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                                    title={`Assegnato a: ${usersMap[client.userId]}`}
                                  >
                                    {usersMap[client.userId].charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Paginazione colonna */}
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    Mostrati {colData.items.length} su {colData.total} clienti
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={colData.page <= 1}
                      onClick={() => fetchColumn(column.id, colData.page - 1)}
                    >
                      Precedente
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {colData.page}/{totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={colData.page >= totalPages}
                      onClick={() => fetchColumn(column.id, colData.page + 1)}
                    >
                      Successiva
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Close transition note modal */}
      <AlertDialog
        open={closeModal !== null}
        onOpenChange={(open) => {
          if (!open) setCloseModal(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nota obbligatoria</AlertDialogTitle>
            <AlertDialogDescription>
              Per chiudere questo cliente è necessario aggiungere una nota di motivazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="closeNote">Nota di chiusura</Label>
            <Textarea
              id="closeNote"
              placeholder="Inserisci il motivo della chiusura..."
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCloseModal(null)}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction onClick={performCloseTransition}>
              Conferma chiusura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
