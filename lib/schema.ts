import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

// ── Companies (multi-tenant) ──
export const companies = sqliteTable("companies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

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
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
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
  categoria: text("categoria"),
  notes: text("notes"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
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
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
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
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
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
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
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
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  trackingId: text("tracking_id"),
  openedAt: integer("opened_at", { mode: "timestamp" }),
  deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Email Templates ──
export const emailTemplates = sqliteTable("email_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  footerImageUrl: text("footer_image_url"),
  author: text("author").notNull().default("Utente"),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Company Settings ──
export const companySettings = sqliteTable("company_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  denominazione: text("denominazione").notNull().default(""),
  piva: text("piva").notNull().default(""),
  cf: text("cf").notNull().default(""),
  indirizzo: text("indirizzo").notNull().default(""),
  città: text("città").notNull().default(""),
  provincia: text("provincia").notNull().default(""),
  cap: text("cap").notNull().default(""),
  email: text("email").notNull().default(""),
  telefono: text("telefono").notNull().default(""),
  footerAttivo: integer("footer_attivo", { mode: "boolean" }).notNull().default(false),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
});

// ── Global Settings (superadmin) ──
export const globalSettings = sqliteTable("global_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Company Rules ──
export const companyRules = sqliteTable("company_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  maxUsers: integer("max_users").notNull().default(0), // 0 = illimitato
  maxClients: integer("max_clients").notNull().default(0), // 0 = illimitato
  maxTasks: integer("max_tasks").notNull().default(0), // 0 = illimitato
  features: text("features", { mode: "json" })
    .notNull()
    .$default(() => "{}"),
  featuresAdmin: text("features_admin", { mode: "json" })
    .notNull()
    .$default(() => "{}"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Log sincronizzazione automatica email (cron) ──
export const cronLog = sqliteTable("cron_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  emailsFound: integer("emails_found").notNull().default(0),
  clientsCreated: integer("clients_created").notNull().default(0),
  tasksCreated: integer("tasks_created").notNull().default(0),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Analisi salvate ──
export const savedAnalyses = sqliteTable("saved_analyses", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  filters: text("filters", { mode: "json" }).notNull(),
  clientIds: text("client_ids", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Comunicazioni (invii programmati a un'analisi con un template) ──
export const comunicazioni = sqliteTable("comunicazioni", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  titolo: text("titolo").notNull(),
  templateId: text("template_id").references(() => emailTemplates.id, {
    onDelete: "set null",
  }),
  analisiId: text("analisi_id").references(() => savedAnalyses.id, {
    onDelete: "set null",
  }),
  dataInvio: integer("data_invio", { mode: "timestamp" }).notNull(),
  stato: text("stato", {
    enum: [
      "programmata",
      "in_elaborazione",
      "inviata",
      "inviata_parziale",
      "fallita",
      "annullata",
    ],
  })
    .notNull()
    .default("programmata"),
  lock: integer("lock", { mode: "boolean" }).notNull().default(false),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Batch di invio di una comunicazione (una riga per cliente) ──
export const comunicazioniBatch = sqliteTable("comunicazioni_batch", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  comunicazioneId: text("comunicazione_id")
    .notNull()
    .references(() => comunicazioni.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  stato: text("stato", { enum: ["pending", "sent", "failed"] })
    .notNull()
    .default("pending"),
  tentativi: integer("tentativi").notNull().default(0),
  errore: text("errore"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ── Tipi ──
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
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
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type CompanySetting = typeof companySettings.$inferSelect;
export type NewCompanySetting = typeof companySettings.$inferInsert;
export type GlobalSetting = typeof globalSettings.$inferSelect;
export type NewGlobalSetting = typeof globalSettings.$inferInsert;
export type CompanyRule = typeof companyRules.$inferSelect;
export type NewCompanyRule = typeof companyRules.$inferInsert;
export type CronLog = typeof cronLog.$inferSelect;
export type NewCronLog = typeof cronLog.$inferInsert;
export type SavedAnalysis = typeof savedAnalyses.$inferSelect;
export type NewSavedAnalysis = typeof savedAnalyses.$inferInsert;
export type Comunicazione = typeof comunicazioni.$inferSelect;
export type NewComunicazione = typeof comunicazioni.$inferInsert;
export type ComunicazioneBatch = typeof comunicazioniBatch.$inferSelect;
export type NewComunicazioneBatch = typeof comunicazioniBatch.$inferInsert;
