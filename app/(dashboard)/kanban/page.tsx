"use client";

import { useEffect, useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/ui/use-toast";
import { clientStatuses, type ClientStatus } from "@/types";

interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  status: ClientStatus;
}

const columns: { id: ClientStatus; title: string }[] = [
  { id: "lead", title: "Lead" },
  { id: "suspect", title: "Suspect" },
  { id: "won", title: "Won" },
  { id: "close", title: "Close" },
];

export default function KanbanPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as ClientStatus;

    // Optimistic update
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
        fetchClients(); // revert
      }
    } catch {
      toast({
        title: "Errore",
        description: "Transizione fallita",
        variant: "destructive",
      });
      fetchClients(); // revert
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
        <h2 className="text-2xl font-bold tracking-tight">Kanban</h2>
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
                      className={`min-h-[200px] rounded-lg border-2 border-dashed p-3 space-y-3 transition-colors ${
                        snapshot.isDraggingOver
                          ? "border-primary bg-primary/5"
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
                              className={`rounded-lg border bg-card text-card-foreground shadow-sm p-3 ${
                                snapshot.isDragging
                                  ? "shadow-lg ring-2 ring-primary"
                                  : ""
                              }`}
                            >
                              <p className="font-medium text-sm truncate">
                                {client.name}
                              </p>
                              {client.company && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {client.company}
                                </p>
                              )}
                              {client.email && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {client.email}
                                </p>
                              )}
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
    </div>
  );
}
