"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  Facebook,
  Image,
  Hash,
  X,
  Eye,
} from "lucide-react";

export default function AdminFacebookPostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authCheck, setAuthCheck] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);

  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user || data.user.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setAuthCheck(true);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const mention = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
    if (!tags.includes(mention)) {
      setTags((prev) => [...prev, mention]);
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast({
        title: "Contenuto richiesto",
        description: "Inserisci il testo del post.",
        variant: "destructive",
      });
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/facebook/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          mediaUrl: mediaUrl.trim() || null,
          tags,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Errore",
          description: data.error || "Errore durante la pubblicazione.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Pubblicato!",
        description: data.message || "Post pubblicato con successo.",
      });

      // Reset form
      setContent("");
      setMediaUrl("");
      setTags([]);
      setPreview(false);
    } catch {
      toast({
        title: "Errore",
        description: "Errore di connessione al server.",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  if (authCheck === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pubblica su Facebook</h2>
        <p className="text-muted-foreground">
          Crea e pubblica un post sulla pagina Facebook di FindFit
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Form ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Facebook className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Nuovo Post</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Contenuto */}
              <div className="space-y-2">
                <Label htmlFor="content">Testo del post</Label>
                <Textarea
                  id="content"
                  placeholder="Cosa vuoi condividere?"
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {content.length} caratteri
                </p>
              </div>

              {/* Media URL */}
              <div className="space-y-2">
                <Label htmlFor="mediaUrl">URL immagine / video</Label>
                <div className="relative">
                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="mediaUrl"
                    className="pl-9"
                    placeholder="https://example.com/image.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                </div>
              </div>

              {/* Tags (@mentions) */}
              <div className="space-y-2">
                <Label htmlFor="tagInput">Tag (@mention)</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="tagInput"
                    className="pl-9"
                    placeholder="nomepagina e premi Invio"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                  />
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                          aria-label={`Rimuovi ${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreview(!preview)}
                  disabled={!content.trim() && !mediaUrl}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {preview ? "Nascondi anteprima" : "Anteprima"}
                </Button>
                <Button type="submit" disabled={publishing || !content.trim()}>
                  {publishing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {publishing ? "Pubblicazione..." : "Pubblica"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Anteprima ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Anteprima</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {preview && (content.trim() || mediaUrl) ? (
              <div className="rounded-lg border bg-card overflow-hidden">
                {/* Intestazione finta */}
                <div className="flex items-center gap-3 p-4 pb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Facebook className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">FindFit</p>
                    <p className="text-xs text-muted-foreground">Pubblicato ora</p>
                  </div>
                </div>

                {/* Media */}
                {mediaUrl && (
                  <div className="px-4 pb-2">
                    <div className="rounded-md overflow-hidden bg-muted aspect-video flex items-center justify-center">
                      {mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video
                          src={mediaUrl}
                          controls
                          className="w-full h-full object-cover"
                        >
                          Il tuo browser non supporta il video.
                        </video>
                      ) : (
                        /* eslint-disable @next/next/no-img-element */
                        <img
                          src={mediaUrl}
                          alt="Media anteprima"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).parentElement!.classList.add("before:content-['Immagine_non_disponibile']", "before:text-muted-foreground", "before:text-sm");
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Contenuto */}
                <div className="p-4 pt-2">
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {content}
                  </p>
                  {tags.length > 0 && (
                    <p className="text-sm text-primary mt-2">
                      {tags.join(" ")}
                    </p>
                  )}
                </div>

                {/* Footer finto */}
                <div className="border-t px-4 py-2 flex gap-4 text-xs text-muted-foreground">
                  <span>👍 0</span>
                  <span>💬 0</span>
                  <span>↗️ 0</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Eye className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">
                  {preview
                    ? "Scrivi del contenuto per vedere l'anteprima"
                    : "Clicca su &ldquo;Anteprima&rdquo; per visualizzare"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
