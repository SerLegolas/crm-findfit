import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

// ── Utenti ──
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Clienti ──
export const clients = sqliteTable("clients", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  status: text("status", {
    enum: ["lead", "suspect", "won", "closed_lost"],
  })
    .notNull()
    .default("lead"),
  notes: text("notes"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Note ──
export const notes = sqliteTable("notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: text("type", {
    enum: ["conversazione", "promemoria", "decisione"],
  })
    .notNull()
    .default("conversazione"),
  author: text("author").notNull().default("Utente"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Task ──
export const tasks = sqliteTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  status: text("status", {
    enum: ["todo", "in_progress", "completed", "cancelled"],
  })
    .notNull()
    .default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high"] })
    .notNull()
    .default("medium"),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Impostazioni IMAP / SMTP ──
export const imapSettings = sqliteTable("imap_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => "default"),
  imapHost: text("imap_host").notNull(),
  imapPort: text("imap_port").notNull(),
  user: text("user").notNull(),
  password: text("password").notNull(),
  filterFrom: text("filter_from").notNull(),
  filterSubject: text("filter_subject").notNull(),
  smtpHost: text("smtp_host"),
  smtpPort: text("smtp_port"),
  smtpSecure: integer("smtp_secure", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Email Log ──
export const emailLog = sqliteTable("email_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sender: text("sender").notNull(),
  author: text("author").notNull().default("Utente"),
  sentAt: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  status: text("status", {
    enum: ["sent", "pending", "failed"],
  })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Company Settings ──
export const companySettings = sqliteTable("company_settings", {
  id: text("id").primaryKey().$defaultFn(() => "default"),
  denominazione: text("denominazione").notNull().default(""),
  piva: text("piva").notNull().default(""),
  cf: text("cf").notNull().default(""),
  indirizzo: text("indirizzo").notNull().default(""),
  città: text("città").notNull().default(""),
  provincia: text("provincia").notNull().default(""),
  cap: text("cap").notNull().default(""),
  email: text("email").notNull().default(""),
  telefono: text("telefono").notNull().default(""),
});

// ── Tipi ──
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type ImapSetting = typeof imapSettings.$inferSelect;
export type NewImapSetting = typeof imapSettings.$inferInsert;
export type EmailLog = typeof emailLog.$inferSelect;
export type NewEmailLog = typeof emailLog.$inferInsert;
export type CompanySetting = typeof companySettings.$inferSelect;
export type NewCompanySetting = typeof companySettings.$inferInsert;
