"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { pageGuides } from "@/constants/pageGuides";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, BookOpen } from "lucide-react";

/**
 * Risolve la guida per il pathname corrente.
 * Prima cerca un match esatto, poi un match per prefisso
 * (es. "/impostazioni/generali" usa la guida di "/impostazioni").
 */
function resolveGuide(pathname: string): string | undefined {
  if (!pathname) return undefined;
  if (pageGuides[pathname]) return pageGuides[pathname];
  const match = Object.keys(pageGuides).find(
    (key) => pathname.startsWith(key + "/")
  );
  return match ? pageGuides[match] : undefined;
}

/** Stile dei componenti Markdown (titoli, elenchi, tabelle, citazioni...). */
const markdownComponents: Components = {
  h2: ({ node: _node, ...props }) => (
    <h2 className="mb-3 mt-6 text-lg font-bold text-foreground first:mt-0" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="mb-2 mt-5 text-base font-bold text-foreground" {...props} />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-foreground" {...props} />
  ),
  p: ({ node: _node, ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="leading-relaxed" {...props} />,
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  em: ({ node: _node, ...props }) => <em {...props} />,
  hr: () => <hr className="my-5 border-t border-border" />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="my-3 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5 text-amber-900"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="bg-muted" {...props} />,
  th: ({ node: _node, ...props }) => (
    <th className="border-b px-3 py-2 text-left font-semibold text-foreground" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-b px-3 py-2 align-top" {...props} />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" {...props} />
  ),
};

export function PageGuide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const guide = useMemo(() => resolveGuide(pathname ?? ""), [pathname]);

  // Estrae il titolo dal primo heading "## " e usa il resto come corpo
  const { title, body } = useMemo(() => {
    if (!guide) return { title: "Aiuto", body: "" };
    const lines = guide.split("\n");
    const idx = lines.findIndex((l) => l.trim().startsWith("## "));
    if (idx >= 0) {
      const t = lines[idx].replace(/^##\s+/, "").trim();
      lines.splice(idx, 1);
      return { title: t || "Aiuto", body: lines.join("\n") };
    }
    return { title: "Aiuto", body: guide };
  }, [guide]);

  // Nessuna guida per questa pagina → non mostrare il pulsante
  if (!guide) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-11 gap-2 rounded-full px-4 shadow-lg"
        size="sm"
        aria-label="Aiuto"
      >
        <HelpCircle className="h-4 w-4" />
        Aiuto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 shrink-0 text-primary" />
              {title}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {body}
              </ReactMarkdown>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
