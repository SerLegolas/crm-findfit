"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { useToast } from "@/components/ui/use-toast";
import {
  clientSchema,
  clientStatuses,
  noteSchema,
  taskSchema,
  emailSchema,
  allowedTransitions,
  requiresNoteForTransition,
  type ClientStatus,
  type NoteType,
  type Priority,
  type EmailStatus,
} from "@/types";
import { formatDate, formatDateTime, isOverdue } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Send,
  Mail,
  MailCheck,
  MailX,
  Clock,
  FileText,
  CheckCircle,
  ListChecks,
  Info,
  CheckSquare,
  Save,
} from "lucide-react";

type Tab = "azioni" | "dettagli" | "note" | "task" | "email";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: ClientStatus;
  notes: string | null;
  userId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface EmailLog {
  id: string;
  clientId: string;
  subject: string;
  body: string;
  sender: string;
  author: string;
  sentAt: number;
  status: EmailStatus;
  createdAt: number;
}

interface Note {
  id: string;
  content: string;
  type: NoteType;
  author: string;
  clientId: string;
  createdAt: number;
  updatedAt: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: number | null;
  status: "todo" | "in_progress" | "completed" | "cancelled";
  priority: Priority;
  completedAt: number | null;
  clientId: string;
  createdAt: number;
  updatedAt: number;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("azioni");
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<ClientStatus | null>(null);

  // Form state for edit
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", company: "", notes: "" });

  // Email
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [defaultSender, setDefaultSender] = useState("");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: "", body: "", sender: "" });
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [sendingEmail, setSendingEmail] = useState(false);

  // Current user & admin user list
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Note form
  const [noteForm, setNoteForm] = useState({ content: "" });
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});

  // Task form
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium" as Priority,
  });
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${params.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClient(data);
      setEditForm({
        name: data.name,
        email: data.email || "",
        phone: data.phone || "",
        company: data.company || "",
        notes: data.notes || "",
      });
    } catch {
      toast({ title: "Errore", description: "Cliente non trovato", variant: "destructive" });
      router.push("/clienti");
    }
  }, [params.id, toast, router]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/note?clientId=${params.id}&days=365`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    }
  }, [params.id]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?clientId=${params.id}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    }
  }, [params.id]);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`/api/email/send?clientId=${params.id}`);
      const data = await res.json();
      setEmails(Array.isArray(data) ? data : []);
    } catch {
      setEmails([]);
    }
  }, [params.id]);

  useEffect(() => {
    // Fetch current user
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.user) {
          setCurrentUser(json.user);
          // Se admin, carica lista utenti
          if (json.user.role === "admin") {
            fetch("/api/users")
              .then((r) => r.json())
              .then((d) => setUsers(d.data || []))
              .catch(() => {});
          }
        }
      })
      .catch(() => {});

    // Carica mittente predefinito dalle impostazioni SMTP
    fetch("/api/imap-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.user) {
          setDefaultSender(data.settings.user);
        }
      })
      .catch(() => {});

    Promise.all([fetchClient(), fetchNotes(), fetchTasks(), fetchEmails()]).finally(() =>
      setLoading(false)
    );
  }, [fetchClient, fetchNotes, fetchTasks, fetchEmails]);

  // ── Status transition ──
  const handleStatusChange = async (newStatus: ClientStatus) => {
    if (!client) return;

    if (requiresNoteForTransition(client.status, newStatus)) {
      setPendingTransition(newStatus);
      setTransitionNote("");
      setShowTransitionDialog(true);
      return;
    }

    await performTransition(newStatus);
  };

  const performTransition = async (newStatus: ClientStatus, noteContent?: string) => {
    if (!client) return;

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          noteContent,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Errore", description: err.error, variant: "destructive" });
        return;
      }

      toast({ title: "Status aggiornato", variant: "success" as any });
      setShowTransitionDialog(false);
      setPendingTransition(null);
      fetchClient();
      fetchTasks();
    } catch {
      toast({ title: "Errore", description: "Transizione fallita", variant: "destructive" });
    }
  };

  // ── Update client details ──
  const handleUpdateClient = async () => {
    if (!client) return;

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error();
      toast({ title: "Cliente aggiornato", variant: "success" as any });
      fetchClient();
    } catch {
      toast({ title: "Errore", description: "Aggiornamento fallito", variant: "destructive" });
    }
  };

  // ── Note CRUD ──
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteErrors({});

    // Auto-set type e author
    const payload = {
      content: noteForm.content,
      type: editNote ? editNote.type : ("conversazione" as NoteType),
      author: editNote ? editNote.author : (currentUser?.name || "Utente"),
    };

    const result = noteSchema.safeParse(payload);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        if (i.path[0]) errors[String(i.path[0])] = i.message;
      });
      setNoteErrors(errors);
      return;
    }

    try {
      const url = editNote ? `/api/note/${editNote.id}` : "/api/note";
      const method = editNote ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, clientId: params.id }),
      });

      if (!res.ok) throw new Error();

      toast({
        title: editNote ? "Nota aggiornata" : "Nota creata",
        variant: "success" as any,
      });
      setNoteModalOpen(false);
      setEditNote(null);
      setNoteForm({ content: "" });
      fetchNotes();
    } catch {
      toast({ title: "Errore", description: "Operazione fallita", variant: "destructive" });
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await fetch(`/api/note/${id}`, { method: "DELETE" });
      toast({ title: "Nota eliminata", variant: "success" as any });
      fetchNotes();
    } catch {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  // ── Task CRUD ──
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskErrors({});

    const result = taskSchema.safeParse(taskForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        if (i.path[0]) errors[String(i.path[0])] = i.message;
      });
      setTaskErrors(errors);
      return;
    }

    try {
      const url = editTask ? `/api/tasks/${editTask.id}` : "/api/tasks";
      const method = editTask ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, clientId: params.id }),
      });

      if (!res.ok) throw new Error();

      toast({
        title: editTask ? "Task aggiornato" : "Task creato",
        variant: "success" as any,
      });
      setTaskModalOpen(false);
      setEditTask(null);
      setTaskForm({ title: "", description: "", dueDate: "", priority: "medium" });
      fetchTasks();
    } catch {
      toast({ title: "Errore", description: "Operazione fallita", variant: "destructive" });
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      const newStatus = task.status === "completed" ? "todo" : "completed";
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch {
      toast({ title: "Errore", description: "Aggiornamento task fallito", variant: "destructive" });
    }
  };

  // ── Email ──
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErrors({});

    const result = emailSchema.safeParse(emailForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        if (i.path[0]) errors[String(i.path[0])] = i.message;
      });
      setEmailErrors(errors);
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, clientId: params.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Errore",
          description: data.error || "Invio fallito",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: data.status === "sent" ? "Email inviata" : "Invio fallito",
        description:
          data.status === "sent"
            ? "L'email è stata inviata con successo"
            : "Errore nell'invio dell'email. Verifica la configurazione SMTP.",
        variant: data.status === "sent" ? ("success" as any) : "destructive",
      });
      setEmailModalOpen(false);
      setEmailForm({ subject: "", body: "", sender: "" });
      fetchEmails();
    } catch {
      toast({ title: "Errore", description: "Invio email fallito", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      toast({ title: "Task eliminato", variant: "success" as any });
      fetchTasks();
    } catch {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  // ── Assign user ──
  const handleAssignUser = async (userId: string) => {
    if (!client) return;
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId || null }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Assegnazione aggiornata", variant: "success" as any });
      fetchClient();
    } catch {
      toast({ title: "Errore", description: "Assegnazione fallita", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  if (!client) return null;

  const allowedNext = allowedTransitions[client.status];

  // Group tasks
  const todoTasks = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const overdueTasksList = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.dueDate && isOverdue(t.dueDate)
  );
  const completedTasks = tasks.filter((t) => t.status === "completed");

  // Timeline: unisce note, task, email ordinati per data decrescente
  const mergedTimeline = (() => {
    const items: {
      id: string;
      type: "note" | "task" | "email";
      date: number;
      data: Note | Task | EmailLog;
    }[] = [];

    const safeNotes = Array.isArray(notes) ? notes : [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeEmails = Array.isArray(emails) ? emails : [];

    safeNotes.forEach((n) => items.push({ id: n.id, type: "note", date: new Date(n.createdAt).getTime(), data: n }));
    safeTasks.forEach((t) => items.push({ id: t.id, type: "task", date: new Date(t.createdAt).getTime(), data: t }));
    safeEmails.forEach((e) => items.push({ id: e.id, type: "email", date: new Date(e.sentAt).getTime(), data: e }));

    items.sort((a, b) => b.date - a.date);
    return items;
  })();

  const tabs: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: "azioni", label: `Azioni (${mergedTimeline.length})`, icon: <ListChecks className="h-4 w-4" /> },
    { key: "dettagli", label: "Dettagli", icon: <Info className="h-4 w-4" /> },
    { key: "note", label: `Note (${notes.length})`, icon: <FileText className="h-4 w-4" /> },
    { key: "task", label: `Task (${tasks.length})`, icon: <CheckSquare className="h-4 w-4" /> },
    { key: "email", label: `Email (${emails.length})`, icon: <Mail className="h-4 w-4" /> },
  ];

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="default" size="icon" onClick={() => router.push("/clienti")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{client.name}</h2>
            <StatusBadge status={client.status} />
          </div>
          <p className="text-muted-foreground">
            Creato il {formatDate(client.createdAt)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── TAB: Azioni (timeline) ── */}
      {activeTab === "azioni" && (
        <div className="space-y-4">
          {/* Intestazione + pulsanti */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Azioni</h3>
            <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={() => {
                        setEditNote(null);
                        setNoteForm({ content: "" });
                        setNoteModalOpen(true);
                        setActiveTab("note");
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Nuova nota</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={() => {
                        setEditTask(null);
                        setTaskForm({ title: "", description: "", dueDate: "", priority: "medium" });
                        setTaskModalOpen(true);
                        setActiveTab("task");
                      }}
                    >
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Nuovo task</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={() => {
                        setEmailForm({ subject: "", body: "", sender: defaultSender });
                        setEmailModalOpen(true);
                        setActiveTab("email");
                      }}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Nuova email</TooltipContent>
                </Tooltip>
              </div>
            </div>

          {/* Timeline */}
          {mergedTimeline.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessuna attività recente
            </p>
          ) : (
            <div className="relative space-y-0">
              {/* Linea verticale */}
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />

              {mergedTimeline.map((item, idx) => (
                <div key={`${item.type}-${item.id}`} className="relative flex gap-4 pb-5">
                  {/* Pallino */}
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background">
                    {item.type === "note" && (
                      <FileText className="h-4 w-4 text-blue-500" />
                    )}
                    {item.type === "task" && (
                      <CheckCircle className="h-4 w-4 text-amber-500" />
                    )}
                    {item.type === "email" && (
                      <Mail className="h-4 w-4 text-green-500" />
                    )}
                  </div>

                  {/* Contenuto */}
                  <div className="flex-1 min-w-0 pt-1.5">
                    {item.type === "note" && (() => {
                      const note = item.data as Note;
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                              Nota
                            </span>
                            <span className="text-xs text-muted-foreground">
                              da {note.author}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(note.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      );
                    })()}

                    {item.type === "task" && (() => {
                      const task = item.data as Task;
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                              Task
                            </span>
                            <PriorityBadge priority={task.priority} />
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(task.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
                          )}
                          {task.dueDate && (
                            <p className={`text-xs mt-0.5 ${isOverdue(task.dueDate) ? "text-destructive" : "text-muted-foreground"}`}>
                              Scadenza: {formatDate(task.dueDate)}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {item.type === "email" && (() => {
                      const email = item.data as EmailLog;
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">
                              Email
                            </span>
                            <span className={`text-xs px-1 py-0.5 rounded-full ${
                              email.status === "sent"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : email.status === "failed"
                                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                            }`}>
                              {email.status === "sent" ? "Inviata" : email.status === "failed" ? "Fallita" : "In coda"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              da {email.author}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(email.sentAt)}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{email.subject}</p>
                          <p className="text-xs text-muted-foreground">Da: {email.sender}</p>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{email.body}</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Dettagli ── */}
      {activeTab === "dettagli" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informazioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Azienda</Label>
                <Input
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Note interne</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="default" size="icon" onClick={handleUpdateClient}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Salva modifiche</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stato Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Status attuale</Label>
                <div className="mt-1">
                  <StatusBadge status={client.status} />
                </div>
              </div>

              {allowedNext.length > 0 && (
                <div className="space-y-2">
                  <Label>Transizioni disponibili</Label>
                  <div className="flex flex-wrap gap-2">
                    {allowedNext.map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(status)}
                      >
                        {status === "closed_lost"
                          ? "Chiudi cliente"
                          : `Sposta a ${status}`}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {client.status === "closed_lost" && (
                <p className="text-sm text-muted-foreground">
                  Questo cliente è chiuso. Non sono possibili ulteriori transizioni.
                </p>
              )}

              {/* Assegnazione utente (solo admin) */}
              {currentUser?.role === "admin" && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Assegnato a</Label>
                  <Select
                    value={client.userId || "__none__"}
                    onValueChange={(val) => handleAssignUser(val === "__none__" ? "" : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nessuno (non assegnato)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB: Note ── */}
      {activeTab === "note" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => {
                    setEditNote(null);
                    setNoteForm({ content: "" });
                    setNoteModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nuova nota</TooltipContent>
            </Tooltip>
            <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editNote ? "Modifica nota" : "Nuova nota"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleNoteSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contenuto</Label>
                    <Textarea
                      value={noteForm.content}
                      onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                      rows={4}
                    />
                    {noteErrors.content && (
                      <p className="text-xs text-destructive">{noteErrors.content}</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setNoteModalOpen(false)}>
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editNote ? "Salva" : "Crea nota"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Note list */}
          {notes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessuna nota</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(note.createdAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">da</span>
                          <span className="text-sm font-medium">{note.author}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {note.content.length > 200
                            ? note.content.substring(0, 200) + "..."
                            : note.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditNote(note);
                                setNoteForm({ content: note.content });
                                setNoteModalOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modifica nota</TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Elimina nota</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare questa nota?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Questa azione è irreversibile.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteNote(note.id)}>
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Task ── */}
      {activeTab === "task" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => {
                    setEditTask(null);
                    setTaskForm({ title: "", description: "", dueDate: "", priority: "medium" });
                    setTaskModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nuovo task</TooltipContent>
            </Tooltip>
            <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editTask ? "Modifica task" : "Nuovo task"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleTaskSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titolo</Label>
                    <Input
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    />
                    {taskErrors.title && (
                      <p className="text-xs text-destructive">{taskErrors.title}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Descrizione</Label>
                    <Textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Scadenza</Label>
                      <Input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Priorità</Label>
                      <Select
                        value={taskForm.priority}
                        onValueChange={(v) => setTaskForm({ ...taskForm, priority: v as Priority })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Bassa</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)}>
                      Annulla
                    </Button>
                    <Button type="submit">
                      {editTask ? "Salva" : "Crea task"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Overdue tasks */}
          {overdueTasksList.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-destructive mb-3">
                Scaduti ({overdueTasksList.length})
              </h3>
              <div className="space-y-2">
                {overdueTasksList.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggleTask(task)}
                    onEdit={() => {
                      setEditTask(task);
                      setTaskForm({
                        title: task.title,
                        description: task.description || "",
                        dueDate: task.dueDate
                          ? new Date(task.dueDate).toISOString().split("T")[0]
                          : "",
                        priority: task.priority,
                      });
                      setTaskModalOpen(true);
                    }}
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Todo tasks */}
          <div>
            <h3 className="text-sm font-medium mb-3">
              Da fare ({todoTasks.length})
            </h3>
            {todoTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun task da fare</p>
            ) : (
              <div className="space-y-2">
                {todoTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggleTask(task)}
                    onEdit={() => {
                      setEditTask(task);
                      setTaskForm({
                        title: task.title,
                        description: task.description || "",
                        dueDate: task.dueDate
                          ? new Date(task.dueDate).toISOString().split("T")[0]
                          : "",
                        priority: task.priority,
                      });
                      setTaskModalOpen(true);
                    }}
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">
                Completati ({completedTasks.length})
              </h3>
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggleTask(task)}
                    onEdit={() => {
                      setEditTask(task);
                      setTaskForm({
                        title: task.title,
                        description: task.description || "",
                        dueDate: task.dueDate
                          ? new Date(task.dueDate).toISOString().split("T")[0]
                          : "",
                        priority: task.priority,
                      });
                      setTaskModalOpen(true);
                    }}
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Email ── */}
      {activeTab === "email" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => {
                    setEmailForm({
                      subject: "",
                      body: "",
                      sender: defaultSender,
                    });
                    setEmailModalOpen(true);
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Nuova email</TooltipContent>
            </Tooltip>
            <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Invia email</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mittente</Label>
                    <Input
                      value={emailForm.sender}
                      disabled
                      className="bg-muted"
                      placeholder="mittente@esempio.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mittente configurato nelle impostazioni email.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Oggetto</Label>
                    <Input
                      value={emailForm.subject}
                      onChange={(e) =>
                        setEmailForm({ ...emailForm, subject: e.target.value })
                      }
                      placeholder="Oggetto dell'email"
                    />
                    {emailErrors.subject && (
                      <p className="text-xs text-destructive">{emailErrors.subject}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Corpo</Label>
                    <Textarea
                      value={emailForm.body}
                      onChange={(e) =>
                        setEmailForm({ ...emailForm, body: e.target.value })
                      }
                      rows={8}
                      placeholder="Scrivi il contenuto dell'email..."
                    />
                    {emailErrors.body && (
                      <p className="text-xs text-destructive">{emailErrors.body}</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEmailModalOpen(false)}
                    >
                      Annulla
                    </Button>
                    <Button type="submit" disabled={sendingEmail}>
                      {sendingEmail ? "Invio in corso..." : "Invia email"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Email list */}
          {emails.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessuna email inviata
            </p>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <Card key={email.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {email.status === "sent" ? (
                            <MailCheck className="h-4 w-4 text-green-500" />
                          ) : email.status === "failed" ? (
                            <MailX className="h-4 w-4 text-destructive" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500" />
                          )}
                          <span className="text-sm font-medium truncate">
                            {email.subject}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {email.status === "sent"
                              ? "Inviata"
                              : email.status === "failed"
                              ? "Fallita"
                              : "In coda"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Da: {email.sender} &middot; {email.author}
                        </p>
                        <p className="text-sm whitespace-pre-wrap line-clamp-3">
                          {email.body}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDateTime(email.sentAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transition note dialog */}
      <AlertDialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nota obbligatoria</AlertDialogTitle>
            <AlertDialogDescription>
              Per chiudere questo cliente è necessario aggiungere una nota di motivazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Inserisci il motivo della chiusura..."
            value={transitionNote}
            onChange={(e) => setTransitionNote(e.target.value)}
            rows={3}
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTransition(null)}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!transitionNote.trim()}
              onClick={() =>
                pendingTransition && performTransition(pendingTransition, transitionNote)
              }
            >
              Conferma chiusura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

// ── Task Card sub-component ──
function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCompleted = task.status === "completed";
  const overdue = task.dueDate && isOverdue(task.dueDate) && !isCompleted;

  return (
    <Card className={`${isCompleted ? "opacity-60" : ""} ${overdue ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}`}>
      <CardContent className="flex items-center gap-3 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onToggle}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isCompleted ? "Riapri task" : "Completa task"}</TooltipContent>
        </Tooltip>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                isCompleted ? "line-through" : ""
              }`}
            >
              {task.title}
            </span>
            <PriorityBadge priority={task.priority} />
            {overdue && (
              <span className="text-xs text-destructive font-medium">Scaduto</span>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {task.description}
            </p>
          )}
          {task.dueDate && (
            <p className={`text-xs mt-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
              Scadenza: {formatDate(task.dueDate)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Modifica task</TooltipContent>
          </Tooltip>
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Elimina task</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare questo task?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione è irreversibile.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Elimina</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
