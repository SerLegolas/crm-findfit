"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  Mail,
  Pencil,
  User,
} from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  footerImageUrl?: string | null;
  author: string;
  createdAt: number | string;
  updatedAt: number | string;
}

function formatDate(value: number | string) {
  if (!value) return "—";
  let d: Date;
  if (typeof value === "number") {
    d = new Date(value > 1e12 ? value : value * 1000);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TemplateAnteprimaPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/email-templates/${id}`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404 ? "Template non trovato" : "Errore nel caricamento del template"
          );
        }
        return r.json();
      })
      .then((t) => {
        if (!cancelled) setTemplate(t);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Errore nel caricamento");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Caricamento
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Caricamento template...
        </div>
      </div>
    );
  }

  // Errore / non trovato
  if (error || !template) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <FileText className="h-7 w-7 text-slate-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Impossibile visualizzare il template</h2>
          <p className="text-sm text-muted-foreground">{error || "Template non trovato"}</p>
        </div>
        <Link href="/template-salvati">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna all&apos;elenco
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Intestazione */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Anteprima Template</h2>
          <p className="text-muted-foreground">{template.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/template-salvati">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna all&apos;elenco
            </Button>
          </Link>
          <Link href={`/template-nuovo?id=${template.id}`}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Pencil className="mr-2 h-4 w-4" />
              Modifica
            </Button>
          </Link>
        </div>
      </div>

      {/* Busta email */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-slate-50/60">
          <CardTitle className="flex items-start gap-2 text-base">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <span>{template.subject || "Nessun oggetto"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 py-4 text-sm sm:grid-cols-3">
          <p className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            Da: <span className="font-medium text-foreground">{template.author || "—"}</span>
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" />
            Creato il {formatDate(template.createdAt)}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" />
            {template.footerImageUrl ? (
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-[10px] text-blue-700"
              >
                Footer immagine
              </Badge>
            ) : (
              <span>Nessun footer immagine</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Corpo email renderizzato */}
      <div className="rounded-xl border bg-slate-200/60 p-4 sm:p-8">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-lg bg-white shadow-md">
          {/* Banner header email */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
            <p className="text-lg font-bold">{template.subject || template.name}</p>
          </div>

          {/* Contenuto */}
          <div className="px-6 py-6">
            {template.bodyHtml ? (
              <div
                className="text-sm leading-relaxed text-slate-800 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-blue-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-500 [&_h1]:mb-2 [&_h1]:text-2xl [&_h2]:mb-2 [&_h2]:text-xl [&_h3]:mb-2 [&_h3]:text-lg [&_img]:h-auto [&_img]:max-w-full [&_li]:ml-4 [&_p]:mb-3 [&_ul]:list-disc [&_ol]:list-decimal"
                dangerouslySetInnerHTML={{ __html: template.bodyHtml }}
              />
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Nessun contenuto nel corpo del template.
              </p>
            )}

            {/* Immagine footer */}
            {template.footerImageUrl && (
              <div className="mt-8 border-t border-slate-100 pt-6 text-center">
                <img
                  src={template.footerImageUrl}
                  alt="Footer"
                  className="mx-auto h-auto max-w-full"
                />
              </div>
            )}
          </div>

          {/* Footer email */}
          <div className="border-t bg-slate-50 px-6 py-3 text-center text-xs text-slate-400">
            Template generato con CRM FindFit
          </div>
        </div>
      </div>
    </div>
  );
}
