"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertCircle,
  ArrowLeft,
  AtSign,
  Bold,
  Check,
  CheckCircle2,
  Eraser,
  Eye,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  RotateCcw,
  Save,
  Underline,
} from "lucide-react";

// ── Tipi ──

type EditorTool = {
  id: string;
  label: React.ReactNode;
  tooltip: string;
  run: () => void;
  separator?: boolean;
};

type FieldName = "name" | "subject" | "body";

// ── Helpers di formattazione ──

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Estrae un eventuale footer immagine già incorporato in coda al bodyHtml
// (per retro-compatibilità) e restituisce il corpo ripulito + l'URL.
function extractFooterInfo(bodyHtml: string): { clean: string; url: string } {
  const footerRegex =
    /<div style="margin-top:32px;text-align:center"><img[^>]*src="([^"]*)"[^>]*\/?><\/div>\s*$/i;
  const match = bodyHtml.match(footerRegex);
  if (match) {
    return {
      clean: bodyHtml.slice(0, bodyHtml.length - match[0].length).trim(),
      url: match[1] || "",
    };
  }
  return { clean: bodyHtml, url: "" };
}

export default function NuovoTemplatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Caricamento...
        </div>
      }
    >
      <TemplateFormContent />
    </Suspense>
  );
}

function TemplateFormContent() {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  const templateId = searchParams.get("id");
  const isEdit = !!templateId;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [footerImageUrl, setFooterImageUrl] = useState("");
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    name: false,
    subject: false,
    body: false,
  });

  // Recupera l'utente corrente (per mostrare chi risulterà autore)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user?.name) setAuthorName(json.user.name);
      })
      .catch(() => {});
  }, []);

  // Modalità modifica: carica il template esistente e popola il form
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    setTemplateLoading(true);
    fetch(`/api/email-templates/${templateId}`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404
              ? "Template non trovato"
              : "Errore nel caricamento del template"
          );
        }
        return r.json();
      })
      .then((t) => {
        if (cancelled) return;
        // Separa il corpo dal footer: l'URL va nel campo dedicato,
        // il corpo non deve contenere il div con l'immagine.
        const { clean, url } = extractFooterInfo(t.bodyHtml ?? "");
        const footerUrl = (t.footerImageUrl ?? "").trim() || url;
        setName(t.name ?? "");
        setSubject(t.subject ?? "");
        setBody(clean);
        setFooterImageUrl(footerUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        toast({
          title: "Errore",
          description:
            err instanceof Error ? err.message : "Errore nel caricamento",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateId, toast]);

  // ── Validazione in tempo reale ──
  const errors = useMemo(() => {
    const e: Partial<Record<FieldName, string>> = {};
    if (!name.trim()) e.name = "Inserisci un nome per il template";
    else if (name.trim().length > 80) e.name = "Il nome non può superare 80 caratteri";
    if (!subject.trim()) e.subject = "Inserisci un oggetto per l'email";
    else if (subject.trim().length > 78) e.subject = "Suggerimento: mantieni l'oggetto sotto i 78 caratteri";
    if (!stripTags(body)) e.body = "Il corpo dell'email è vuoto";
    return e;
  }, [name, subject, body]);

  const bodyTextLength = useMemo(() => stripTags(body).length, [body]);

  // URL immagine footer (opzionale) — validato in tempo reale se compilato
  const footerUrlError = footerImageUrl.trim()
    ? /^https?:\/\/.+/i.test(footerImageUrl.trim())
      ? undefined
      : "Inserisci un URL valido (deve iniziare con http:// o https://)"
    : undefined;

  const isValid = Object.keys(errors).length === 0 && !footerUrlError;
  const showError = (field: FieldName) => touched[field] && errors[field];

  // Corpo finale: contenuto + immagine footer (se presente)
  const finalBodyHtml = useMemo(() => {
    const footer = footerImageUrl.trim()
      ? `<div style="margin-top:32px;text-align:center"><img src="${footerImageUrl.trim()}" alt="" style="max-width:100%;height:auto" /></div>`
      : "";
    return `${body}\n${footer}`.trim();
  }, [body, footerImageUrl]);

  // ── Azioni editor ──
  const wrapSelection = (open: string, close: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = body.slice(s, e);
    const next = body.slice(0, s) + open + selected + close + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = s + open.length + selected.length + close.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const next = body.slice(0, s) + text + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = s + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const wrapHeading = (tag: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selStart = s === e ? body.lastIndexOf("\n", s - 1) + 1 : s;
    const selEnd =
      s === e
        ? (() => {
            const n = body.indexOf("\n", s);
            return n === -1 ? body.length : n;
          })()
        : e;
    const before = body.slice(0, selStart);
    const selected = body.slice(selStart, selEnd).trim();
    const after = body.slice(selEnd);
    const next = `${before}<${tag}>${selected}</${tag}>${after}`;
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = selStart + `<${tag}>`.length + selected.length + `</${tag}>`.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const alignSelection = (align: "left" | "center" | "right") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = body.slice(s, e);
    const open = `<div style="text-align:${align}">`;
    const next = body.slice(0, s) + open + selected + "</div>" + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = s + open.length + selected.length + "</div>".length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const makeLink = () => {
    const url = window.prompt("Inserisci l'URL del link:", "https://");
    if (url === null) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = body.slice(s, e).trim() || "testo del link";
    const open = `<a href="${url}" target="_blank" rel="noopener">`;
    const next = body.slice(0, s) + open + selected + "</a>" + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = s + open.length + selected.length + "</a>".length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const makeImage = () => {
    const url = window.prompt("URL dell'immagine:", "https://");
    if (url === null) return;
    insertAtCursor(
      `<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px" />`
    );
  };

  const removeFormat = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = body.slice(s, e);
    const clean = selected.replace(/<[^>]*>/g, "");
    const next = body.slice(0, s) + clean + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = s + clean.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const tools: EditorTool[] = [
    { id: "bold", label: <Bold className="h-4 w-4" />, tooltip: "Grassetto (Ctrl+B)", run: () => wrapSelection("<strong>", "</strong>") },
    { id: "italic", label: <Italic className="h-4 w-4" />, tooltip: "Corsivo (Ctrl+I)", run: () => wrapSelection("<em>", "</em>") },
    { id: "underline", label: <Underline className="h-4 w-4" />, tooltip: "Sottolineato (Ctrl+U)", run: () => wrapSelection("<u>", "</u>") },
    { id: "link", label: <Link2 className="h-4 w-4" />, tooltip: "Inserisci link (Ctrl+K)", run: makeLink },
    { id: "sep1", label: <span className="h-5 w-px bg-border" />, tooltip: "", run: () => {}, separator: true },
    { id: "h1", label: <Heading1 className="h-4 w-4" />, tooltip: "Titolo H1", run: () => wrapHeading("h1") },
    { id: "h2", label: <Heading2 className="h-4 w-4" />, tooltip: "Titolo H2", run: () => wrapHeading("h2") },
    { id: "h3", label: <Heading3 className="h-4 w-4" />, tooltip: "Titolo H3", run: () => wrapHeading("h3") },
    { id: "p", label: <Pilcrow className="h-4 w-4" />, tooltip: "Paragrafo", run: () => wrapSelection("<p>", "</p>") },
    { id: "sep2", label: <span className="h-5 w-px bg-border" />, tooltip: "", run: () => {}, separator: true },
    { id: "align-left", label: <AlignLeft className="h-4 w-4" />, tooltip: "Allinea a sinistra", run: () => alignSelection("left") },
    { id: "align-center", label: <AlignCenter className="h-4 w-4" />, tooltip: "Centra", run: () => alignSelection("center") },
    { id: "align-right", label: <AlignRight className="h-4 w-4" />, tooltip: "Allinea a destra", run: () => alignSelection("right") },
    { id: "sep3", label: <span className="h-5 w-px bg-border" />, tooltip: "", run: () => {}, separator: true },
    { id: "ul", label: <List className="h-4 w-4" />, tooltip: "Lista puntata", run: () => wrapSelection("<ul>\n  <li>", "</li>\n</ul>") },
    { id: "ol", label: <ListOrdered className="h-4 w-4" />, tooltip: "Lista numerata", run: () => wrapSelection("<ol>\n  <li>", "</li>\n</ol>") },
    { id: "image", label: <ImageIcon className="h-4 w-4" />, tooltip: "Inserisci immagine", run: makeImage },
    { id: "hr", label: <Minus className="h-4 w-4" />, tooltip: "Linea separatrice", run: () => insertAtCursor('<hr style="border:0;border-top:1px solid #cbd5e1;margin:16px 0" />') },
    { id: "br", label: <span className="font-mono text-xs font-bold">br</span>, tooltip: "A capo (br)", run: () => insertAtCursor("<br />") },
    { id: "sep4", label: <span className="h-5 w-px bg-border" />, tooltip: "", run: () => {}, separator: true },
    { id: "remove", label: <Eraser className="h-4 w-4" />, tooltip: "Rimuovi formattazione", run: removeFormat },
  ];

  const tags = [
    { id: "name", label: "@name", hint: "Nome del cliente" },
    { id: "company", label: "@company", hint: "Azienda del cliente" },
    { id: "data", label: "@data", hint: "Data odierna" },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    switch (e.key.toLowerCase()) {
      case "b":
        e.preventDefault();
        wrapSelection("<strong>", "</strong>");
        break;
      case "i":
        e.preventDefault();
        wrapSelection("<em>", "</em>");
        break;
      case "u":
        e.preventDefault();
        wrapSelection("<u>", "</u>");
        break;
      case "k":
        e.preventDefault();
        makeLink();
        break;
      default:
        break;
    }
  };

  const markTouched = (field: FieldName) =>
    setTouched((t) => ({ ...t, [field]: true }));

  // ── Salvataggio ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, subject: true, body: true });
    if (!isValid) {
      toast({
        title: "Template non valido",
        description: "Correggi i campi evidenziati per salvare.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/email-templates/${templateId}`
        : "/api/email-templates";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          bodyHtml: body,
          footerImageUrl: footerImageUrl.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Errore",
          description: data.error || "Salvataggio fallito. Riprova.",
          variant: "destructive",
        });
        return;
      }
      setSaved(true);
      toast({
        title: isEdit ? "Template aggiornato" : "Template creato",
        description: `"${name.trim()}" è stato salvato correttamente.`,
        variant: "success" as any,
      });
    } catch {
      toast({
        title: "Errore",
        description: "Errore durante il salvataggio. Controlla la connessione.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName("");
    setSubject("");
    setBody("");
    setFooterImageUrl("");
    setTouched({ name: false, subject: false, body: false });
    setSaved(false);
    textareaRef.current?.focus();
  };

  // Schermata di caricamento mentre recupero il template da modificare
  if (templateLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Caricamento template...
        </div>
      </div>
    );
  }

  // ── Rendering ──
  return (
    <TooltipProvider delayDuration={250}>
      <div className="space-y-6">
        {/* Intestazione */}
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEdit ? "Modifica Template" : "Nuovo Template Email"}
          </h2>
          <p className="text-muted-foreground">
            {isEdit
              ? "Aggiorna i dettagli del template: le modifiche si riflettono in tempo reale nell'anteprima."
              : "Crea un modello di email personalizzato: scrivi il contenuto a sinistra, l'anteprima si aggiorna in tempo reale a destra."}
          </p>
        </div>

        {/* Banner successo */}
        {saved && (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  {isEdit
                    ? "Template aggiornato con successo"
                    : "Template salvato con successo"}
                </p>
                <p className="text-xs text-emerald-700">
                  {isEdit
                    ? "Puoi tornare ai template salvati o continuare a modificare."
                    : "Puoi creare un altro template oppure gestire quelli esistenti."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Crea un altro
              </Button>
              <Link href="/template-salvati">
                <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <FileText className="mr-2 h-4 w-4" />
                  Vai ai template salvati
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* ── Colonna sinistra: form ── */}
          <form onSubmit={handleSave} className="space-y-6 xl:col-span-3">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="space-y-5 pt-6">
                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="template-name" className="flex items-center gap-1.5">
                    Nome del template
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="template-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => markTouched("name")}
                      placeholder="Es. Newsletter mensile"
                      className={
                        showError("name")
                          ? "border-destructive pr-10 focus-visible:ring-destructive"
                          : name && touched.name
                            ? "border-emerald-400 pr-10"
                            : "pr-10"
                      }
                    />
                    {showError("name") ? (
                      <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                    ) : name ? (
                      <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                    ) : null}
                  </div>
                  {showError("name") ? (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {name.trim().length}/80 caratteri
                    </p>
                  )}
                </div>

                {/* Oggetto */}
                <div className="space-y-2">
                  <Label htmlFor="template-subject" className="flex items-center gap-1.5">
                    Oggetto dell&apos;email
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="template-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      onBlur={() => markTouched("subject")}
                      placeholder="Es. Le novità del mese sono qui"
                      className={
                        showError("subject")
                          ? "border-destructive pr-10 focus-visible:ring-destructive"
                          : subject && touched.subject
                            ? "border-emerald-400 pr-10"
                            : "pr-10"
                      }
                    />
                    {showError("subject") ? (
                      <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                    ) : subject ? (
                      <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                    ) : null}
                  </div>
                  {showError("subject") ? (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.subject}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {subject.trim().length}/78 caratteri — consigliato per una
                      migliore apertura
                    </p>
                  )}
                </div>

                {/* Corpo: editor con toolbar avanzata */}
                <div className="space-y-2">
                  <Label htmlFor="template-body" className="flex items-center gap-1.5">
                    Corpo dell&apos;email
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-0.5 border-b bg-slate-50 px-2 py-1.5">
                      {tools.map((tool) =>
                        tool.separator ? (
                          <span
                            key={tool.id}
                            className="mx-1 h-5 w-px shrink-0 bg-slate-200"
                          />
                        ) : (
                          <Tooltip key={tool.id}>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-md text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                                onClick={tool.run}
                              >
                                {tool.label}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">{tool.tooltip}</TooltipContent>
                          </Tooltip>
                        )
                      )}
                    </div>

                    {/* Barra tag dinamici */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b bg-blue-50/50 px-2 py-1.5">
                      <AtSign className="h-3.5 w-3.5 text-blue-500" />
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Tag dinamici
                      </span>
                      {tags.map((tag) => (
                        <Tooltip key={tag.id}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 font-mono text-[11px]"
                              onClick={() => insertAtCursor(tag.label)}
                            >
                              {tag.label}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">{tag.hint}</TooltipContent>
                        </Tooltip>
                      ))}
                      <span className="ml-auto hidden text-[10px] text-muted-foreground sm:block">
                        Seleziona del testo e usa la toolbar
                      </span>
                    </div>

                    {/* Textarea sorgente */}
                    <Textarea
                      ref={textareaRef}
                      id="template-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onBlur={() => markTouched("body")}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        "Scrivi il contenuto qui...\n\nSuggerimento: seleziona del testo e usa i pulsanti della toolbar per formattarlo.\nUsa i tag dinamici (@name, @company, @data) per personalizzare l'email."
                      }
                      className={`min-h-[280px] rounded-none border-0 font-mono text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 ${
                        showError("body") ? "bg-red-50/40" : ""
                      }`}
                    />
                  </div>
                  {showError("body") ? (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.body}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {bodyTextLength} caratteri di testo
                    </p>
                  )}
                </div>

                {/* Immagine footer */}
                <div className="space-y-2">
                  <Label htmlFor="template-footer-image" className="flex items-center gap-1.5">
                    URL Immagine Footer
                    <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="template-footer-image"
                      type="url"
                      value={footerImageUrl}
                      onChange={(e) => setFooterImageUrl(e.target.value)}
                      placeholder="Es. https://tuodominio.it/logo.png"
                      className={
                        footerUrlError
                          ? "border-destructive pr-10 focus-visible:ring-destructive"
                          : footerImageUrl.trim()
                            ? "border-emerald-400 pr-10"
                            : "pr-10"
                      }
                    />
                    {footerUrlError ? (
                      <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                    ) : footerImageUrl.trim() ? (
                      <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                    ) : null}
                  </div>
                  {footerUrlError ? (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {footerUrlError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      L&apos;immagine verrà aggiunta in fondo all&apos;email (footer) tramite tag{" "}
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
                        &lt;img /&gt;
                      </code>
                      .
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Azioni */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {isEdit ? (
                <Link href="/template-salvati">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Torna all&apos;elenco
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Azzera form
                </Button>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {authorName ? `Sarai salvato come: ${authorName}` : "Autore: utente corrente"}
                </span>
                <Button
                  type="submit"
                  disabled={!isValid || saving}
                  className="min-w-[180px] bg-blue-600 shadow-md shadow-blue-600/20 transition-shadow hover:bg-blue-700 hover:shadow-lg disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving
                    ? isEdit
                      ? "Aggiornamento..."
                      : "Salvataggio..."
                    : isEdit
                      ? "Aggiorna"
                      : "Salva template"}
                </Button>
              </div>
            </div>
          </form>

          {/* ── Colonna destra: anteprima live ── */}
          <div className="space-y-6 xl:col-span-2">
            <Card className="overflow-hidden border-slate-200 shadow-lg xl:sticky xl:top-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-slate-50/60">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4 text-blue-600" />
                  Anteprima live
                </CardTitle>
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Auto
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative">
                  {finalBodyHtml ? (
                    <iframe
                      title="Anteprima template email"
                      sandbox="allow-same-origin"
                      className="h-[420px] w-full rounded-b-xl bg-white"
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;padding:24px;line-height:1.65;font-size:15px}img{max-width:100%;height:auto}blockquote{border-left:3px solid #93c5fd;margin:0;padding-left:12px;color:#334155}</style></head><body>${finalBodyHtml}</body></html>`}
                    />
                  ) : (
                    <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 rounded-b-xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <Eye className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">
                        L&apos;anteprima apparirà qui
                      </p>
                      <p className="max-w-[220px] text-xs text-muted-foreground">
                        Scrivi il corpo del template e la resa HTML si aggiornerà
                        in tempo reale.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Checklist validazione */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b bg-slate-50/60 py-3">
                <CardTitle className="text-sm">Stato del template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 py-4">
                {(
                  [
                    { key: "name" as const, label: "Nome", ok: !!name.trim() },
                    { key: "subject" as const, label: "Oggetto", ok: !!subject.trim() },
                    { key: "body" as const, label: "Corpo", ok: !!stripTags(body) },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2"
                  >
                    <span className="text-sm text-slate-600">{item.label}</span>
                    {item.ok ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Completo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Da compilare
                      </span>
                    )}
                  </div>
                ))}

                {/* Riepilogo */}
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-muted-foreground">
                  {isValid ? (
                    <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Tutti i campi sono validi: puoi salvare il template.
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 font-medium text-amber-700">
                      <AlertCircle className="h-4 w-4" />
                      {Object.keys(errors).length}{" "}
                      {Object.keys(errors).length === 1 ? "campo da completare" : "campi da completare"}
                    </p>
                  )}
                </div>

                {/* Legenda tag */}
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tag dinamici disponibili
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
                        @name
                      </code>{" "}
                      — sostituito con il nome del cliente
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
                        @company
                      </code>{" "}
                      — sostituito con l&apos;azienda del cliente
                    </li>
                    <li>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">
                        @data
                      </code>{" "}
                      — sostituito con la data odierna
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
