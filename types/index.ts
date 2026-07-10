import { z } from "zod";

// ── Utente ──
export const userRoles = ["admin", "user"] as const;
export type UserRole = (typeof userRoles)[number];

export const userSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(6, "Minimo 6 caratteri").optional().or(z.literal("")),
  name: z.string().min(1, "Il nome è obbligatorio"),
  role: z.enum(userRoles).default("user"),
  isActive: z.boolean().default(true),
});

export type UserFormData = z.infer<typeof userSchema>;

// ── Login ──
export const loginSchema = z.object({
  email: z.string().email("Email non valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ── Client ──
export const clientStatuses = ["lead", "suspect", "won", "closed_lost"] as const;
export type ClientStatus = (typeof clientStatuses)[number];

export const clientSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  status: z.enum(clientStatuses).default("lead"),
  categoria: z.string().optional().or(z.literal("")),
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

// ── Email Log ──
export const emailStatuses = ["sent", "pending", "failed"] as const;
export type EmailStatus = (typeof emailStatuses)[number];

export const emailSchema = z.object({
  subject: z.string().min(1, "L'oggetto è obbligatorio"),
  body: z.string().min(1, "Il corpo è obbligatorio"),
  sender: z.string().email("Email mittente non valida"),
});

export type EmailFormData = z.infer<typeof emailSchema>;

// ── Email Template ──
export const emailTemplateSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  subject: z.string().min(1, "L'oggetto è obbligatorio"),
  bodyHtml: z.string().min(1, "Il corpo è obbligatorio"),
});

export type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;

// ── Transizioni status ──
export const allowedTransitions: Record<ClientStatus, ClientStatus[]> = {
  lead: ["suspect", "won", "closed_lost"],
  suspect: ["lead", "won", "closed_lost"],
  won: [],
  closed_lost: ["lead", "suspect", "won"],
};

export function requiresNoteForTransition(
  from: ClientStatus,
  to: ClientStatus
): boolean {
  return (from === "lead" || from === "suspect") && to === "closed_lost";
}
