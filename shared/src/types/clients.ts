import { z } from "zod";

// ── Client ── (specchio di frontend/types, sorgente per il backend)
export const clientStatuses = ["lead", "suspect", "won", "closed_lost"] as const;
export type ClientStatus = (typeof clientStatuses)[number];

export const clientSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  email: z.string().min(1, "L'email è obbligatoria").email("Email non valida"),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  status: z.enum(clientStatuses).default("lead"),
  categoria: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type ClientInput = z.infer<typeof clientSchema>;
