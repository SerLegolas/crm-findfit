"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) setCurrentUserId(json.user.id);
      })
      .catch(() => {});

    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          const map: Record<string, string> = {};
          json.data.forEach((u: any) => { map[u.id] = u.name; });
          setUsersMap(map);
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

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients?limit=100");
      const data = await res.json();
      setClients(data.data);
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

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

    // Optimistic update
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, status: "closed_lost" } : c
      )
    );
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
        fetchClients();
      }
    } catch {
      toast({
        title: "Errore",
        description: "Transizione fallita",
        variant: "destructive",
      });
      fetchClients();
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

    // Optimistic update for normal transitions
    setClients((prev) =>
      prev.map((c) =>
        c.id === draggableId ? { ...c, status: newStatus } : c
      )
    );

    try {
      const res = await fetch(`/api/clients/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error, variant: "destructive" });
        fetchClients();
      }
    } catch {
      toast({
        title: "Errore",
        description: "Transizione fallita",
        variant: "destructive",
      });
      fetchClients();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Trattative</h2>
        <p className="text-muted-foreground">
          Trascina i clienti tra le colonne per aggiornare lo status
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => {
            const columnClients = clients.filter(
              (c) => c.status === column.id
            );

            return (
              <div key={column.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {columnClients.length}
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
                      {columnClients.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          Nessun cliente
                        </p>
                      )}

                      {columnClients.map((client, index) => (
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
