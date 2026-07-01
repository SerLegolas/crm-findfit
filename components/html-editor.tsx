"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type ToolbarAction = {
  label: string;
  tooltip: string;
  openTag: string;
  closeTag: string;
};

const actions: ToolbarAction[] = [
  { label: "B", tooltip: "Grassetto (Ctrl+B)", openTag: "<strong>", closeTag: "</strong>" },
  { label: "I", tooltip: "Corsivo (Ctrl+I)", openTag: "<em>", closeTag: "</em>" },
  { label: "U", tooltip: "Sottolineato (Ctrl+U)", openTag: "<u>", closeTag: "</u>" },
  { label: "🔗", tooltip: "Link", openTag: '<a href="https://">', closeTag: "</a>" },
  { label: "H1", tooltip: "Titolo H1", openTag: "<h1>", closeTag: "</h1>" },
  { label: "H2", tooltip: "Titolo H2", openTag: "<h2>", closeTag: "</h2>" },
  { label: "P", tooltip: "Paragrafo", openTag: "<p>", closeTag: "</p>" },
  { label: "UL", tooltip: "Lista non ordinata", openTag: "<ul>\n  <li>", closeTag: "</li>\n</ul>" },
  { label: "OL", tooltip: "Lista ordinata", openTag: "<ol>\n  <li>", closeTag: "</li>\n</ol>" },
  { label: "🖼", tooltip: "Immagine", openTag: '<img src="', closeTag: '" alt="" />' },
];

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

  const wrapSelection = (openTag: string, closeTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    const newText = `${before}${openTag}${selected || ""}${closeTag}${after}`;
    onChange(newText);

    // Riposiziona il cursore dopo l'inserimento
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + openTag.length + (selected || "").length + closeTag.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="rounded-md border">
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
                    onClick={() => wrapSelection(action.openTag, action.closeTag)}
                  >
                    {action.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{action.tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
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
    </div>
  );
}
