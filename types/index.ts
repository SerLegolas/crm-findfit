import { z } from "zod";

// ── Client ──
export const clientStatuses = ["lead", "suspect", "won", "close"] as const;
export type ClientStatus = (typeof clientStatuses)[number];

export const clientSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  status: z.enum(clientStatuses).default("lead"),
  notes: z.string().optional().or(z.literal("")),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ── Note ──
export const noteTypes = ["conversazione", "promemoria", "decisione"] as const;
export type NoteType = (typeof noteTypes)[number];

export const noteSchema = z.object({
  content: z.string().min(1, "Il contenuto è obbligatorio"),
  type: z.enum(noteTypes).default("conversazione"),
  author: z.string().min(1, "L'autore è obbligatorio").default("Utente"),
});

export type NoteFormData = z.infer<typeof noteSchema>;

// ── Task ──
export const taskStatuses = [
  "todo",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const priorities = ["low", "medium", "high"] as const;
export type Priority = (typeof priorities)[number];

export const taskSchema = z.object({
  title: z.string().min(1, "Il titolo è obbligatorio"),
  description: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  status: z.enum(taskStatuses).default("todo"),
  priority: z.enum(priorities).default("medium"),
});

export type TaskFormData = z.infer<typeof taskSchema>;

// ── Transizioni status ──
export const allowedTransitions: Record<ClientStatus, ClientStatus[]> = {
  lead: ["suspect", "close"],
  suspect: ["won", "close"],
  won: ["close"],
  close: [],
};

export function requiresNoteForTransition(
  from: ClientStatus,
  to: ClientStatus
): boolean {
  return (from === "lead" || from === "suspect") && to === "close";
}
