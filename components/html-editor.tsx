"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Code, Type } from "lucide-react";

type HandlerParams = {
  value: string;
  start: number;
  end: number;
  textarea: HTMLTextAreaElement;
  onChange: (v: string) => void;
};

type ToolbarAction = {
  label: string;
  tooltip: string;
  handler: (params: HandlerParams) => void;
};

function wrapHandler(openTag: string, closeTag: string) {
  return ({ value, start, end, textarea, onChange }: HandlerParams) => {
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const newText = `${before}${openTag}${selected || ""}${closeTag}${after}`;
    onChange(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + openTag.length + (selected || "").length + closeTag.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };
}

function headingHandler(tag: string) {
  return ({ value, start, end, textarea, onChange }: HandlerParams) => {
    // Se non c'è selezione, prendi l'intera riga corrente
    const selStart = start === end ? value.lastIndexOf("\n", start - 1) + 1 : start;
    const selEnd = start === end
      ? (() => { const n = value.indexOf("\n", start); return n === -1 ? value.length : n; })()
      : end;
    const before = value.slice(0, selStart);
    const selected = value.slice(selStart, selEnd).trim();
    const after = value.slice(selEnd);
    const newText = `${before}<${tag}>${selected}</${tag}>${after}`;
    onChange(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = selStart + `<${tag}>`.length + selected.length + `</${tag}>`.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };
}

function alignHandler(align: "left" | "center" | "right") {
  return ({ value, start, end, textarea, onChange }: HandlerParams) => {
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const newText = `${before}<div style="text-align:${align}">${selected || ""}</div>${after}`;
    onChange(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + `<div style="text-align:${align}">`.length + (selected || "").length + "</div>".length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };
}

function unwrapHandler({ value, start, end, textarea, onChange }: HandlerParams) {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);
  const clean = selected.replace(/<[^>]*>/g, "");
  const newText = `${before}${clean}${after}`;
  onChange(newText);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursorPos = start + clean.length;
    textarea.setSelectionRange(cursorPos, cursorPos);
  });
}

function insertTagHandler(tag: string) {
  return ({ value, start, end, textarea, onChange }: HandlerParams) => {
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newText = `${before}${tag}${after}`;
    onChange(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + tag.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };
}

const actions: ToolbarAction[] = [
  { label: "B", tooltip: "Grassetto (Ctrl+B)", handler: wrapHandler("<strong>", "</strong>") },
  { label: "I", tooltip: "Corsivo (Ctrl+I)", handler: wrapHandler("<em>", "</em>") },
  { label: "U", tooltip: "Sottolineato (Ctrl+U)", handler: wrapHandler("<u>", "</u>") },
  { label: "🔗", tooltip: "Link", handler: wrapHandler('<a href="https://">', "</a>") },
  { label: "H1", tooltip: "Titolo H1 (riga intera)", handler: headingHandler("h1") },
  { label: "H2", tooltip: "Titolo H2 (riga intera)", handler: headingHandler("h2") },
  { label: "P", tooltip: "Paragrafo", handler: wrapHandler("<p>", "</p>") },
  { label: "⬅", tooltip: "Allinea a sinistra", handler: alignHandler("left") },
  { label: "➡", tooltip: "Allinea a destra", handler: alignHandler("right") },
  { label: "⬌", tooltip: "Centra", handler: alignHandler("center") },
  { label: "UL", tooltip: "Lista non ordinata", handler: wrapHandler("<ul>\n  <li>", "</li>\n</ul>") },
  { label: "OL", tooltip: "Lista ordinata", handler: wrapHandler("<ol>\n  <li>", "</li>\n</ol>") },
  { label: "🖼", tooltip: "Immagine", handler: wrapHandler('<img src="', '" alt="" />') },
  { label: "↵", tooltip: "A capo (br)", handler: insertTagHandler("<br />") },
  { label: "✕", tooltip: "Rimuovi formattazione", handler: unwrapHandler },
];

const tagActions: ToolbarAction[] = [
  { label: "@name", tooltip: "Inserisci @name (nome cliente)", handler: insertTagHandler("@name") },
  { label: "@company", tooltip: "Inserisci @company (azienda cliente)", handler: insertTagHandler("@company") },
  { label: "@data", tooltip: "Inserisci @data (data odierna)", handler: insertTagHandler("@data") },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

interface HtmlEditorProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function HtmlEditor({
  id,
  label,
  value,
  onChange,
  placeholder,
  className,
}: HtmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const execAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    action.handler({ value, start, end, textarea, onChange });
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="rounded-md border">
        {/* Toolbar formattazione */}
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
          <TooltipProvider delayDuration={300}>
            {actions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 min-w-7 px-1.5 text-xs font-medium"
                    onClick={() => execAction(action)}
                  >
                    {action.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{action.tooltip}</TooltipContent>
              </Tooltip>
            ))}

            <div className="flex-1" />

            {/* Toggle anteprima Testo / HTML */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={showPreview ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <Type className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
                  {showPreview ? "Testo" : "HTML"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {showPreview ? "Mostra anteprima HTML" : "Mostra anteprima testo"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Barra tag dinamici */}
        <div className="flex flex-wrap items-center gap-1 border-b bg-blue-50/40 dark:bg-blue-950/20 px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            Tag:
          </span>
          <TooltipProvider delayDuration={300}>
            {tagActions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] px-2 font-mono"
                    onClick={() => execAction(action)}
                  >
                    {action.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{action.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        {/* Textarea (sempre HTML source) */}
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`min-h-[200px] border-0 rounded-t-none font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 ${className || ""}`}
          required
        />
      </div>

      {/* Anteprima live */}
      {showPreview && (
        <div className="rounded-md border bg-white p-4 min-h-[100px]">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
            Anteprima
          </p>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        </div>
      )}

      {!showPreview && value && (
        <div className="rounded-md border bg-muted/20 p-4 min-h-[100px] whitespace-pre-wrap">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
            Testo semplice
          </p>
          <p className="text-sm">{stripHtml(value) || "—"}</p>
        </div>
      )}
    </div>
  );
}
