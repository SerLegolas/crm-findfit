"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { isOverdue } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  Phone,
  Building2,
  User,
  Calendar,
  List,
  Mail,
  FileText,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { Priority } from "@/types";

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  dueDate: number | null;
  status: string;
  priority: Priority;
  completedAt: number | null;
  clientId: string;
  clientName: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCompany?: string | null;
}

const DAY_OPTIONS = [7, 15, 30, 60, 90] as const;

const STATUS_LABELS: Record<string, string> = {
  todo: "Da fare",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Cancellato",
};

const DAYS_OF_WEEK = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

export default function TaskCalendarPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [listFilter, setListFilter] = useState<"today" | "all">("all");

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("upcomingDays", "365");

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data);
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile caricare i task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Filtra i task localmente in base ai giorni selezionati (senza ricaricare)
  const filteredTasks = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + selectedDays);
    cutoff.setHours(23, 59, 59, 999);
    return tasks.filter((t) => !t.dueDate || new Date(t.dueDate) <= cutoff);
  }, [tasks, selectedDays]);

  // Per la vista lista: filtra ulteriormente per oggi se listFilter === "today"
  // Helper: data in formato YYYY-MM-DD usando ora locale (evita problemi fuso orario di toISOString)
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const listTasks = useMemo(() => {
    if (listFilter === "all") return filteredTasks;
    const todayStr = toLocalDateStr(new Date());
    return filteredTasks.filter((t) => {
      if (!t.dueDate) return false;
      return toLocalDateStr(new Date(t.dueDate)) === todayStr;
    });
  }, [filteredTasks, listFilter]);

  // Build a map: dateString -> tasks[], sorted with active first, completed/cancelled last
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    filteredTasks.forEach((task) => {
      if (!task.dueDate) return;
      const dateStr = toLocalDateStr(new Date(task.dueDate));
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(task);
    });
    // Sort each day: pending first, completed/cancelled last
    const order = { todo: 0, in_progress: 1, completed: 2, cancelled: 3 };
    for (const dateStr of Object.keys(map)) {
      map[dateStr].sort((a, b) => (order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0));
    }
    return map;
  }, [filteredTasks]);

  // Genera griglia di N giorni da oggi, organizzati in settimane (7 colonne)
  const calendarGrid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateStr(today);

    const weeks: {
      day: number;
      month: number;
      isToday: boolean;
      dateStr: string;
      tasks: TaskItem[];
    }[][] = [];
    let week: (typeof weeks)[number] = [];

    // Padding iniziale per allineare al giorno della settimana
    const startPad = today.getDay();
    for (let i = 0; i < startPad; i++) {
      week.push({
        day: 0,
        month: 0,
        isToday: false,
        dateStr: "",
        tasks: [],
      });
    }

    for (let d = 0; d < selectedDays; d++) {
      const cellDate = new Date(today);
      cellDate.setDate(today.getDate() + d);
      const dateStr = toLocalDateStr(cellDate);
      const isToday = dateStr === todayStr;
      const tasksForDay = tasksByDate[dateStr] || [];
      week.push({
        day: cellDate.getDate(),
        month: cellDate.getMonth(),
        isToday,
        dateStr,
        tasks: tasksForDay,
      });

      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    // Padding finale per completare l'ultima settimana
    if (week.length > 0) {
      while (week.length < 7) {
        week.push({
          day: 0,
          month: 0,
          isToday: false,
          dateStr: "",
          tasks: [],
        });
      }
      weeks.push(week);
    }

    return weeks;
  }, [selectedDays, filteredTasks]);

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "todo" : "completed";
    const now = newStatus === "completed" ? Date.now() : null;
    // Optimistic update locale
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: newStatus, completedAt: now }
          : t
      )
    );
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, status: currentStatus, completedAt: currentStatus === "completed" ? Date.now() : null }
              : t
          )
        );
        toast({
          title: "Errore",
          description: "Aggiornamento fallito",
          variant: "destructive",
        });
      }
    } catch {
      // Revert on network error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, status: currentStatus, completedAt: currentStatus === "completed" ? Date.now() : null }
            : t
        )
      );
      toast({
        title: "Errore",
        description: "Aggiornamento fallito",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, source, destination } = result;

    if (!destination) return;

    const sourceDateStr = source.droppableId;
    const destDateStr = destination.droppableId;

    if (sourceDateStr === destDateStr) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggableId
          ? { ...t, dueDate: new Date(destDateStr + "T12:00:00").getTime() }
          : t
      )
    );

    try {
      const res = await fetch(`/api/tasks/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: destDateStr }),
      });

      if (!res.ok) {
        fetchTasks();
        toast({
          title: "Errore",
          description: "Spostamento task fallito",
          variant: "destructive",
        });
      }
    } catch {
      fetchTasks();
      toast({
        title: "Errore",
        description: "Spostamento task fallito",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (task: TaskItem): string => {
    if (task.status === "completed") return "border-l-green-500 bg-gray-100/80 dark:bg-gray-800/40";
    if (task.status === "in_progress") return "border-l-blue-500";
    if (task.status === "cancelled") return "border-l-gray-400";
    if (task.dueDate && isOverdue(task.dueDate)) return "border-l-red-500";
    return "border-l-amber-500";
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendario Task</h2>
          <p className="text-muted-foreground">
            {viewMode === "calendar"
              ? "Trascina i task tra i giorni per modificarne la scadenza"
              : "Elenco dei task nei prossimi giorni"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            variant={viewMode === "calendar" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("calendar")}
            className="h-8 w-8 p-0"
            title="Vista calendario"
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 w-8 p-0"
            title="Vista lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground mr-1">Giorni:</span>
          {DAY_OPTIONS.map((d) => (
            <Button
              key={d}
              variant={selectedDays === d ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDays(d)}
              className="min-w-[2.5rem]"
            >
              {d}
            </Button>
          ))}
        </div>

      </div>

      {viewMode === "calendar" ? (
        /* ─── Vista calendario ─── */
        <TooltipProvider delayDuration={300}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Prossimi {selectedDays} giorni
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_OF_WEEK.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-muted-foreground py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar weeks */}
              <div className="space-y-1">
                {calendarGrid.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((cell, ci) =>
                      cell.day === 0 ? (
                        <div
                          key={ci}
                          className="rounded-lg min-h-[7rem] bg-muted/20"
                        />
                      ) : (
                        <Droppable
                          key={ci}
                          droppableId={cell.dateStr}
                          isDropDisabled={false}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`
                                rounded-lg p-1 min-h-[7rem] text-sm transition-colors
                                ${cell.isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                                ${
                                  snapshot.isDraggingOver
                                    ? "bg-accent"
                                    : "hover:bg-accent/30"
                                }
                              `}
                            >
                              {/* Day number */}
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-xs font-medium ${
                                    cell.isToday ? "text-primary" : "text-foreground"
                                  }`}
                                >
                                  {cell.day}
                                </span>
                                {cell.tasks.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {cell.tasks.length}
                                  </span>
                                )}
                              </div>

                              {/* Task badges */}
                              <div className="space-y-1">
                                {cell.tasks.map((task, tIndex) => (
                                  <Draggable
                                    key={task.id}
                                    draggableId={task.id}
                                    index={tIndex}
                                  >
                                    {(provided, snapshot) => {
                                      const dragProps = provided.dragHandleProps as React.HTMLAttributes<HTMLDivElement>;
                                      return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...dragProps}
                                            className={`
                                              group relative rounded-md border border-l-4 p-1.5 text-xs
                                              bg-card hover:shadow-sm transition-shadow cursor-grab active:cursor-grabbing
                                              ${getStatusColor(task)}
                                              ${snapshot.isDragging ? "shadow-lg z-50 opacity-90" : ""}
                                            `}
                                          >
                                            {/* Title row with toggle */}
                                            <div className="flex items-start gap-1">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggle(task.id, task.status);
                                                }}
                                                className="shrink-0 mt-0.5"
                                              >
                                                {task.status === "completed" ? (
                                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                ) : (
                                                  <Circle className="h-3 w-3 text-muted-foreground" />
                                                )}
                                              </button>
                                              <span
                                                className={`font-medium leading-tight ${
                                                  task.status === "completed"
                                                    ? "line-through text-muted-foreground"
                                                    : ""
                                                }`}
                                              >
                                                {task.title}
                                              </span>
                                            </div>

                                            {/* Client info compatto */}
                                            {task.clientName && (
                                              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                                <User className="h-2.5 w-2.5 shrink-0" />
                                                <span className="truncate">
                                                  {task.clientName}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" align="start" className="w-72 p-3">
                                          <div className="space-y-2">
                                            <p className="text-sm font-semibold">{task.title}</p>
                                            <div className="space-y-1.5 text-xs text-muted-foreground">
                                              {task.clientName && (
                                                <div className="flex items-center gap-2">
                                                  <User className="h-3.5 w-3.5 shrink-0" />
                                                  <span>{task.clientName}</span>
                                                </div>
                                              )}
                                              {task.clientEmail && (
                                                <div className="flex items-center gap-2">
                                                  <Mail className="h-3.5 w-3.5 shrink-0" />
                                                  <span className="truncate">{task.clientEmail}</span>
                                                </div>
                                              )}
                                              {task.clientPhone && (
                                                <div className="flex items-center gap-2">
                                                  <Phone className="h-3.5 w-3.5 shrink-0" />
                                                  <span>{task.clientPhone}</span>
                                                </div>
                                              )}
                                              {task.clientCompany && (
                                                <div className="flex items-center gap-2">
                                                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                                                  <span>{task.clientCompany}</span>
                                                </div>
                                              )}
                                              {task.description && (
                                                <div className="flex items-start gap-2 pt-1 border-t">
                                                  <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                  <span className="line-clamp-4">{task.description}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  }}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            </div>
                          )}
                        </Droppable>
                      )
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </DragDropContext>
        </TooltipProvider>
      ) : (
        /* ─── Vista lista ─── */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Lista task — Prossimi {selectedDays} giorni
              </CardTitle>
              <div className="flex items-center gap-1 rounded-lg border p-0.5">
                <Button
                  variant={listFilter === "today" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setListFilter("today")}
                  className="h-7 px-2 text-xs"
                >
                  Oggi
                </Button>
                <Button
                  variant={listFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setListFilter("all")}
                  className="h-7 px-2 text-xs"
                >
                  Tutti
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3 w-8"></th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Titolo</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Cliente</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Scadenza</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {listTasks
                    .slice()
                    .sort((a, b) => {
                      const order = { todo: 0, in_progress: 1, completed: 2, cancelled: 3 };
                      return (order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0);
                    })
                    .map((task) => (
                      <tr
                        key={task.id}
                        className={`border-b last:border-0 hover:bg-accent/50 transition-colors ${
                          task.status === "completed" ? "bg-gray-50/50 dark:bg-gray-900/20" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggle(task.id, task.status)}
                            className="shrink-0"
                          >
                            {task.status === "completed" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              task.status === "completed"
                                ? "line-through text-muted-foreground"
                                : ""
                            }`}
                          >
                            {task.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.clientName || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString("it-IT", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              task.status === "completed"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : task.status === "in_progress"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : task.status === "cancelled"
                                ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            {STATUS_LABELS[task.status] || task.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {listTasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nessun task trovato
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
