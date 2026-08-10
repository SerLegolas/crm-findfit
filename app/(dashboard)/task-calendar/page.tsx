"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  ChevronLeft,
  ChevronRight,
  Loader2,
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

// Helper: data in formato YYYY-MM-DD usando ora locale (evita problemi fuso orario di toISOString)
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const STATUS_LABELS: Record<string, string> = {
  todo: "Da fare",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Cancellato",
};

const DAYS_OF_WEEK = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

export default function TaskCalendarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [tasksByMonth, setTasksByMonth] = useState<Map<string, TaskItem[]>>(
    new Map()
  );
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [listFilter, setListFilter] = useState<"today" | "all">("all");

  // Chiave "YYYY-MM" del mese visualizzato
  const monthKey = useMemo(
    () =>
      `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}`,
    [viewDate]
  );

  // Task del mese visualizzato (se già caricato in memoria)
  const monthTasks = tasksByMonth.get(monthKey);

  // Carica (e salva nella mappa) i task di un mese specifico
  const loadMonth = useCallback(
    async (key: string) => {
      setLoadingMonth(key);
      try {
        const res = await fetch(`/api/tasks?month=${key}`);
        const data = await res.json();
        setTasksByMonth((prev) => {
          const next = new Map(prev);
          next.set(key, Array.isArray(data) ? data : []);
          return next;
        });
      } catch {
        toast({
          title: "Errore",
          description: "Impossibile caricare i task",
          variant: "destructive",
        });
      } finally {
        setLoadingMonth((cur) => (cur === key ? null : cur));
      }
    },
    [toast]
  );

  // All'avvio e alla navigazione: carica il mese solo se non è già in memoria
  useEffect(() => {
    if (!tasksByMonth.has(monthKey)) {
      loadMonth(monthKey);
    }
  }, [monthKey, tasksByMonth, loadMonth]);

  // Navigazione mensile
  const goPrevMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Titolo "Mese Anno" (es. "Agosto 2026")
  const monthLabel = useMemo(
    () =>
      viewDate
        .toLocaleDateString("it-IT", { month: "long", year: "numeric" })
        .replace(/^\w/, (c) => c.toUpperCase()),
    [viewDate]
  );

  // Per la vista lista: filtra ulteriormente per oggi se listFilter === "today"
  const listTasks = useMemo(() => {
    const base = monthTasks ?? [];
    if (listFilter === "all") return base;
    const todayStr = toLocalDateStr(new Date());
    return base.filter((t) => {
      if (!t.dueDate) return false;
      return toLocalDateStr(new Date(t.dueDate)) === todayStr;
    });
  }, [monthTasks, listFilter]);

  // Build a map: dateString -> tasks[], sorted with active first, completed/cancelled last
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    (monthTasks ?? []).forEach((task) => {
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
  }, [monthTasks]);

  // Genera la griglia del mese visualizzato, con settimane complete (padding con giorni del mese precedente/successivo)
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = toLocalDateStr(new Date());

    const weeks: {
      day: number;
      month: number;
      isToday: boolean;
      isCurrentMonth: boolean;
      dateStr: string;
      tasks: TaskItem[];
    }[][] = [];
    let week: (typeof weeks)[number] = [];

    // Padding iniziale: giorni del mese precedente per allineare alla settimana
    const startPad = firstDay.getDay();
    for (let i = startPad; i > 0; i--) {
      const padDate = new Date(year, month, 1 - i);
      week.push({
        day: padDate.getDate(),
        month: padDate.getMonth(),
        isToday: false,
        isCurrentMonth: false,
        dateStr: toLocalDateStr(padDate),
        tasks: [],
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const dateStr = toLocalDateStr(cellDate);
      const isToday = dateStr === todayStr;
      week.push({
        day: d,
        month,
        isToday,
        isCurrentMonth: true,
        dateStr,
        tasks: tasksByDate[dateStr] || [],
      });

      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    // Padding finale: giorni del mese successivo per completare l'ultima settimana
    if (week.length > 0) {
      let nextDay = 1;
      while (week.length < 7) {
        const padDate = new Date(year, month + 1, nextDay);
        week.push({
          day: padDate.getDate(),
          month: padDate.getMonth(),
          isToday: false,
          isCurrentMonth: false,
          dateStr: toLocalDateStr(padDate),
          tasks: [],
        });
        nextDay++;
      }
      weeks.push(week);
    }

    return weeks;
  }, [viewDate, tasksByDate]);

  // Aggiorna un task nella mappa dei mesi (dove si trova)
  const patchTask = useCallback(
    (taskId: string, updater: (t: TaskItem) => TaskItem) => {
      setTasksByMonth((prev) => {
        const next = new Map(prev);
        // Ogni task appartiene a un solo mese: forEach è sufficiente
        next.forEach((arr, key) => {
          const idx = arr.findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            const newArr = arr.slice();
            newArr[idx] = updater(arr[idx]);
            next.set(key, newArr);
          }
        });
        return next;
      });
    },
    []
  );

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "todo" : "completed";
    const now = newStatus === "completed" ? Date.now() : null;
    // Optimistic update locale
    patchTask(id, (t) => ({ ...t, status: newStatus, completedAt: now }));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Revert on error
        patchTask(id, (t) => ({
          ...t,
          status: currentStatus,
          completedAt: currentStatus === "completed" ? Date.now() : null,
        }));
        toast({
          title: "Errore",
          description: "Aggiornamento fallito",
          variant: "destructive",
        });
      }
    } catch {
      // Revert on network error
      patchTask(id, (t) => ({
        ...t,
        status: currentStatus,
        completedAt: currentStatus === "completed" ? Date.now() : null,
      }));
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
    patchTask(draggableId, (t) => ({
      ...t,
      dueDate: new Date(destDateStr + "T12:00:00").getTime(),
    }));

    try {
      const res = await fetch(`/api/tasks/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: destDateStr }),
      });

      if (!res.ok) {
        loadMonth(monthKey);
        toast({
          title: "Errore",
          description: "Spostamento task fallito",
          variant: "destructive",
        });
      }
    } catch {
      loadMonth(monthKey);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendario Task</h2>
          <p className="text-muted-foreground">
            {viewMode === "calendar"
              ? "Trascina i task tra i giorni per modificarne la scadenza"
              : "Elenco dei task del mese visualizzato"}
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

      {/* Navigazione mensile */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrevMonth}
            title="Mese precedente"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goNextMonth}
            title="Mese successivo"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} className="h-8">
            Oggi
          </Button>
        </div>
        <h3 className="text-lg font-semibold capitalize">{monthLabel}</h3>
      </div>

      {viewMode === "calendar" ? (
        /* ─── Vista calendario ─── */
        <TooltipProvider delayDuration={300}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Calendario mensile</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!monthTasks ? (
                <div className="flex h-48 items-center justify-center">
                  {loadingMonth === monthKey ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="text-center text-sm text-muted-foreground">
                      <p>Impossibile caricare i task di questo mese.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => loadMonth(monthKey)}
                      >
                        Riprova
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                      !cell.isCurrentMonth ? (
                        <div
                          key={ci}
                          className="rounded-lg min-h-[7rem] bg-muted/10 p-1"
                        >
                          <span className="text-xs font-medium text-muted-foreground/60">
                            {cell.day}
                          </span>
                        </div>
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
                                ${
                                  snapshot.isDraggingOver
                                    ? "bg-accent"
                                    : cell.isToday
                                      ? "bg-yellow-200/70"
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
                                      const handleProps = provided.dragHandleProps as React.HTMLAttributes<HTMLDivElement>;
                                      const { style: dragStyle, ...restDraggable } = provided.draggableProps as React.HTMLAttributes<HTMLDivElement>;
                                      return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            ref={provided.innerRef}
                                            {...restDraggable}
                                            {...handleProps}
                                            style={dragStyle}
                                            onClick={() =>
                                              router.push(
                                                `/clienti/${task.clientId}?from=task-calendar`
                                              )
                                            }
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
                </>
              )}
            </CardContent>
          </Card>
        </DragDropContext>
        </TooltipProvider>
      ) : (
        /* ─── Vista lista ─── */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Lista task — {monthLabel}</CardTitle>
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
            {!monthTasks ? (
              <div className="flex items-center justify-center py-12">
                {loadingMonth === monthKey ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Impossibile caricare i task di questo mese.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => loadMonth(monthKey)}
                    >
                      Riprova
                    </Button>
                  </div>
                )}
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
