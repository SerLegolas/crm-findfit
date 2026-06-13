"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, isOverdue, daysUntil } from "@/lib/utils";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type { ClientStatus, Priority } from "@/types";

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
}

export default function TaskPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?upcomingDays=7");
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

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "todo" : "completed";
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch {
      toast({
        title: "Errore",
        description: "Aggiornamento fallito",
        variant: "destructive",
      });
    }
  };

  const overdueTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.dueDate && isOverdue(t.dueDate)
  );

  const upcomingTasks = tasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.status !== "cancelled" &&
      t.dueDate &&
      !isOverdue(t.dueDate) &&
      daysUntil(t.dueDate) <= 7
  );

  // Group by client
  const groupByClient = (taskList: TaskItem[]) => {
    const groups: Record<string, { clientName: string; clientId: string; tasks: TaskItem[] }> = {};
    taskList.forEach((t) => {
      const key = t.clientId;
      if (!groups[key]) {
        groups[key] = {
          clientName: t.clientName || "Sconosciuto",
          clientId: t.clientId,
          tasks: [],
        };
      }
      groups[key].tasks.push(t);
    });
    return Object.values(groups);
  };

  const overdueGroups = groupByClient(overdueTasks);
  const upcomingGroups = groupByClient(upcomingTasks);

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
        <h2 className="text-2xl font-bold tracking-tight">Task Scaduti</h2>
        <p className="text-muted-foreground">
          Task scaduti o in scadenza nei prossimi 7 giorni
        </p>
      </div>

      {/* Overdue section */}
      <div>
        <h3 className="text-lg font-semibold text-destructive mb-4 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
          Scaduti ({overdueTasks.length})
        </h3>
        {overdueGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-4">Nessun task scaduto</p>
        ) : (
          <div className="space-y-4">
            {overdueGroups.map((group) => (
              <div key={group.clientId}>
                <button
                  onClick={() => router.push(`/clienti/${group.clientId}`)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-2"
                >
                  {group.clientName}
                  <ExternalLink className="h-3 w-3" />
                </button>
                <div className="space-y-2 pl-4">
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task.id, task.status)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming section */}
      <div>
        <h3 className="text-lg font-semibold text-amber-500 mb-4 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          In scadenza (7 giorni) ({upcomingTasks.length})
        </h3>
        {upcomingGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-4">Nessun task in scadenza</p>
        ) : (
          <div className="space-y-4">
            {upcomingGroups.map((group) => (
              <div key={group.clientId}>
                <button
                  onClick={() => router.push(`/clienti/${group.clientId}`)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-2"
                >
                  {group.clientName}
                  <ExternalLink className="h-3 w-3" />
                </button>
                <div className="space-y-2 pl-4">
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task.id, task.status)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: TaskItem;
  onToggle: () => void;
}) {
  return (
    <Card className={task.dueDate && isOverdue(task.dueDate) ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}>
      <CardContent className="flex items-center gap-3 py-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onToggle}>
          {task.status === "completed" ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{task.title}</span>
            <PriorityBadge priority={task.priority} />
            {task.dueDate && isOverdue(task.dueDate) && task.status !== "completed" && (
              <span className="text-xs text-destructive font-medium">Scaduto</span>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {task.description}
            </p>
          )}
          {task.dueDate && (
            <p
              className={`text-xs mt-0.5 ${
                task.dueDate && isOverdue(task.dueDate)
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              Scadenza: {formatDate(task.dueDate)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
