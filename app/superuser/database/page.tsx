"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Database,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface ColumnInfo {
  name: string;
  type: string;
  notNull: number;
  pk: number;
  defaultValue: unknown;
}

interface TableInfo {
  name: string;
  count: number;
  columns: ColumnInfo[];
}

interface SchemaData {
  generatedAt: string;
  totalRecords: number;
  tables: TableInfo[];
}

export default function SuperuserDatabasePage() {
  const router = useRouter();
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  async function loadSchema() {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const res = await fetch("/api/superuser/db-schema");
      if (res.status === 401) {
        router.push("/superuser/login");
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        setSchemaError(err.error || "Errore nel caricamento dello schema");
        return;
      }
      const data = await res.json();
      setSchema(data);
    } catch {
      setSchemaError("Errore di rete nel caricamento dello schema");
    } finally {
      setSchemaLoading(false);
    }
  }

  useEffect(() => {
    loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDownloadBackup() {
    setBackupLoading(true);
    setBackupError(null);
    try {
      const res = await fetch("/api/superuser/db-backup");
      if (res.status === 401) {
        router.push("/superuser/login");
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        setBackupError(err.error || "Errore nella creazione del backup");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename =
        match?.[1] ||
        `crm-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setBackupError("Errore di rete durante il download del backup");
    } finally {
      setBackupLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Database
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Struttura dello schema e backup dei dati dell&apos;intero sistema.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Schema DB */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Schema DB
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSchema}
                disabled={schemaLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${schemaLoading ? "animate-spin" : ""}`}
                />
                Aggiorna
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {schemaLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
                Caricamento schema...
              </div>
            ) : schemaError ? (
              <p className="text-sm text-destructive">{schemaError}</p>
            ) : schema ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {schema.tables.length} tabelle ·{" "}
                  {schema.totalRecords.toLocaleString("it-IT")} record totali
                </p>
                <div className="rounded-lg border">
                  {schema.tables.map((t, i) => (
                    <div key={t.name} className={i > 0 ? "border-t" : ""}>
                      <button
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [t.name]: !p[t.name] }))
                        }
                        className="flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors"
                      >
                        <span className="flex items-center gap-2 font-medium">
                          {expanded[t.name] ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          {t.name}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {t.count.toLocaleString("it-IT")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {t.columns.length} col
                          </span>
                        </span>
                      </button>
                      {expanded[t.name] && (
                        <div className="px-3 pb-3">
                          <div className="overflow-x-auto rounded-md border bg-muted/30">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                  <th className="px-2 py-1 font-medium">Colonna</th>
                                  <th className="px-2 py-1 font-medium">Tipo</th>
                                  <th className="px-2 py-1 font-medium">PK</th>
                                  <th className="px-2 py-1 font-medium">NOT NULL</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.columns.map((c) => (
                                  <tr
                                    key={c.name}
                                    className="border-b last:border-0"
                                  >
                                    <td className="px-2 py-1 font-medium">
                                      {c.name}
                                    </td>
                                    <td className="px-2 py-1">{c.type}</td>
                                    <td className="px-2 py-1">
                                      {c.pk ? "✓" : ""}
                                    </td>
                                    <td className="px-2 py-1">
                                      {c.notNull ? "✓" : ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scarica un file JSON con tutti i dati di tutte le tabelle del
              sistema. Il file è datato e scaricabile.
            </p>
            <Button
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              className="gap-2"
            >
              {backupLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generazione backup...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Scarica Backup JSON
                </>
              )}
            </Button>
            {backupError && (
              <p className="text-sm text-destructive">{backupError}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
