"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/utils";
import { noteTypes, type NoteType } from "@/types";
import { Search } from "lucide-react";

interface NoteItem {
  id: string;
  content: string;
  type: NoteType;
  author: string;
  clientId: string;
  createdAt: number;
  clientName: string | null;
}

export default function NotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const fetchNotes = useCallback(async () => {
    try {
      const params = new URLSearchParams({ days: "30" });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/note?${params}`);
      const data = await res.json();
      setNotes(data);
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile caricare le note",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, toast]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Note Recenti</h2>
        <p className="text-muted-foreground">
          Ultime 30 giorni di note
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca nel contenuto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tutti i tipi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {noteTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Nessuna nota trovata</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push(`/clienti/${note.clientId}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge
                    status={
                      note.type === "conversazione"
                        ? "lead"
                        : note.type === "promemoria"
                        ? "suspect"
                        : "won"
                    }
                  />
                  <span className="text-sm font-medium">
                    {note.clientName || "Cliente sconosciuto"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {note.author}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDateTime(note.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-3">
                  {note.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
