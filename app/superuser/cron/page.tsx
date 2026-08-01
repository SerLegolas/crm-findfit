"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  History,
} from "lucide-react";

type CronLogEntry = {
  id: string;
  companyId: string;
  companyName: string | null;
  startedAt: string;
  completedAt: string | null;
  emailsFound: number;
  clientsCreated: number;
  tasksCreated: number;
  error: string | null;
  createdAt: string;
};

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT");
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default function SuperuserCronPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [logs, setLogs] = useState<CronLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/cron/logs");
      if (res.status === 401) {
        router.push("/superuser/login");
        return;
      }
      if (!res.ok) throw new Error("Errore caricamento");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile caricare i log cron.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-muted-foreground" />
            Log Sincronizzazione Email
          </h2>
          <p className="text-muted-foreground">
            Storico delle esecuzioni del cron automatico per tutte le aziende.
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Aggiorna
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Esecuzioni</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna esecuzione registrata. Il cron non è ancora stato eseguito.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Azienda</th>
                    <th className="py-2 pr-4 font-medium">Inizio</th>
                    <th className="py-2 pr-4 font-medium">Fine</th>
                    <th className="py-2 pr-4 font-medium">Durata</th>
                    <th className="py-2 pr-4 font-medium text-right">Email</th>
                    <th className="py-2 pr-4 font-medium text-right">Clienti</th>
                    <th className="py-2 pr-4 font-medium text-right">Task</th>
                    <th className="py-2 font-medium">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        {log.companyName || log.companyId}
                      </td>
                      <td className="py-2 pr-4">{formatDate(log.startedAt)}</td>
                      <td className="py-2 pr-4">{formatDate(log.completedAt)}</td>
                      <td className="py-2 pr-4">
                        {formatDuration(log.startedAt, log.completedAt)}
                      </td>
                      <td className="py-2 pr-4 text-right">{log.emailsFound}</td>
                      <td className="py-2 pr-4 text-right">
                        {log.clientsCreated}
                      </td>
                      <td className="py-2 pr-4 text-right">{log.tasksCreated}</td>
                      <td className="py-2">
                        {log.error ? (
                          <span
                            className="inline-flex items-center gap-1 text-destructive"
                            title={log.error}
                          >
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="max-w-[220px] truncate">
                              {log.error}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
