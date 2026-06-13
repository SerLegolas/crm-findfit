"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/priority-badge";
import { formatDate, isOverdue } from "@/lib/utils";
import { AlertTriangle, TrendingUp, AlertCircle, Calendar } from "lucide-react";
import type { ClientStatus, Priority } from "@/types";

interface TaskItem {
  id: string;
  title: string;
  priority: Priority;
  dueDate: number | null;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
}

interface DashboardData {
  statusCounts: Record<ClientStatus, number>;
  overdueCount: number;
  overdueTasks: TaskItem[];
  dueTodayTasks: TaskItem[];
  trendData: { date: string; count: number }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[Dashboard] Fetch avviato");
    fetch("/api/dashboard")
      .then((r) => {
        console.log("[Dashboard] Response status:", r.status);
        if (!r.ok) throw new Error(`Errore HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        console.log("[Dashboard] JSON ricevuto:", json);
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => {
        console.error("[Dashboard] Errore fetch:", err.message);
        setError(err.message);
      })
      .finally(() => {
        console.log("[Dashboard] Fetch completato");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Errore di caricamento</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Nessun dato disponibile</p>
      </div>
    );
  }

  const maxTrend = Math.max(...data.trendData.map((d) => d.count), 1);

  const statusCards: { key: ClientStatus; label: string; variant: "info" | "warning" | "success" | "muted"; bgClass: string }[] = [
    { key: "lead", label: "Lead", variant: "info", bgClass: "bg-blue-50" },
    { key: "suspect", label: "Suspect", variant: "warning", bgClass: "bg-yellow-50" },
    { key: "won", label: "Won", variant: "success", bgClass: "bg-green-50" },
    { key: "closed_lost", label: "Closed Lost", variant: "muted", bgClass: "bg-gray-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Panoramica del tuo CRM FindFit
        </p>
      </div>

      {/* Overdue banner */}
      {data.overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            Attenzione: {data.overdueCount} task scaduti richiedono la tua attenzione!
          </p>
        </div>
      )}

      {/* Status cards: solo 4 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statusCards.map(({ key, label, variant, bgClass }) => (
          <Card key={key} className={bgClass}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Badge variant={variant}>{label}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.statusCounts[key]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task lists */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Task scaduti */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Task scaduti
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {data.overdueTasks.length} task
            </span>
          </CardHeader>
          <CardContent>
            {data.overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun task scaduto
              </p>
            ) : (
              <div className="space-y-2">
                {data.overdueTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/clienti/${task.clientId}`)}
                    className="w-full flex items-center gap-3 rounded-lg border border-red-100 bg-red-50/50 p-3 text-left text-sm transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/20 dark:hover:bg-red-950/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">{task.clientName || "Sconosciuto"}</span>
                        {task.clientPhone && <> · {task.clientPhone}</>}
                        {task.dueDate && <> · scad. {formatDate(task.dueDate)}</>}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task in scadenza oggi */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Task in scadenza oggi
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {data.dueTodayTasks.length} task
            </span>
          </CardHeader>
          <CardContent>
            {data.dueTodayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun task in scadenza oggi
              </p>
            ) : (
              <div className="space-y-2">
                {data.dueTodayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/clienti/${task.clientId}`)}
                    className="w-full flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-left text-sm transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">{task.clientName || "Sconosciuto"}</span>
                        {task.clientPhone && <> · {task.clientPhone}</>}
                        {task.dueDate && <> · scad. {formatDate(task.dueDate)}</>}
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trend Clienti (7 giorni)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {data.trendData.map((item) => (
              <div
                key={item.date}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-md bg-primary/20 transition-all hover:bg-primary/30"
                  style={{
                    height: `${Math.max((item.count / maxTrend) * 100, 4)}%`,
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.count}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.date}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
