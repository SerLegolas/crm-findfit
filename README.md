# CRM FindFit

Sistema CRM professionale built con Next.js 14+, Turso (SQLite) e Drizzle ORM.

## Stack Tecnologico

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Database**: Turso (SQLite edge database)
- **ORM**: Drizzle ORM
- **Validazione**: Zod
- **Drag & Drop**: @hello-pangea/dnd
- **Deploy**: Vercel

## Funzionalità

- **Dashboard**: Panoramica con conteggi per status, task scaduti, ultime note, trend clienti
- **Lista Clienti**: Tabella con ricerca, filtri, ordinamento, paginazione e CRUD completo
- **Dettaglio Cliente**: Tab con dettagli modificabili, note cronologiche e task
- **Kanban**: 4 colonne (Lead/Suspect/Won/Close) con drag & drop
- **Task Scaduti**: Task raggruppati per cliente con badge priorità
- **Note Recenti**: Ricerca e filtro per tipo

### Regole Business

- **Transizioni status**: lead→suspect, lead→close (nota obbligatoria), suspect→won, suspect→close (nota obbligatoria), won→close
- **Task automatici**: suspect crea "Chiamata qualificazione" (3gg), won crea "Invia contratto" (2gg) e "Onboarding" (7gg)
- **Banner rosso** su dashboard se ci sono task scaduti

## Setup Locale

### Prerequisiti

- Node.js 18+
- Un account [Turso](https://turso.tech)

### Installazione

```bash
# Clona il repository
git clone <your-repo-url>
cd crm-findfit

# Installa le dipendenze
npm install

# Configura le variabili d'ambiente
cp .env.local .env.local
# Modifica .env.local con i tuoi dati Turso
```

### Configurazione Database Turso

```bash
# Installa Turso CLI
npm install -g turso

# Login
turso auth login

# Crea un database
turso db create crm-findfit

# Ottieni le credenziali
turso db show crm-findfit --url
turso db tokens create crm-findfit

# Aggiorna .env.local
# TURSO_DB_URL=<url-ottenuto>
# TURSO_AUTH_TOKEN=<token-ottenuto>
```

### Esegui le migrazioni

```bash
# Genera le migrazioni
npm run db:generate

# Pusha lo schema sul database
npm run db:push

# Oppure esegui le migrazioni
npm run db:migrate
```

### Avvia in sviluppo

```bash
npm run dev
```

L'applicazione sarà disponibile su [http://localhost:3000](http://localhost:3000).

## Deploy su Vercel

1. Crea un repository su GitHub e carica il codice
2. Connetti il repository a [Vercel](https://vercel.com)
3. Imposta le variabili d'ambiente in Vercel:
   - `TURSO_DB_URL`
   - `TURSO_AUTH_TOKEN`
4. Deploy!

## Variabili d'Ambiente

```env
TURSO_DB_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

## Struttura del Progetto

```
crm-findfit/
├── app/
│   ├── (dashboard)/          # Layout con sidebar e topbar
│   │   ├── dashboard/        # Pagina dashboard
│   │   ├── clienti/          # Lista e dettaglio clienti
│   │   ├── kanban/           # Kanban board
│   │   ├── task/             # Task scaduti
│   │   ├── note/             # Note recenti
│   │   └── impostazioni/     # Impostazioni
│   ├── api/                  # API routes
│   │   ├── clients/          # CRUD clienti
│   │   ├── note/             # CRUD note
│   │   ├── tasks/            # CRUD task
│   │   └── dashboard/        # Dati dashboard
│   └── layout.tsx
├── components/
│   ├── ui/                   # Componenti shadcn/ui
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── status-badge.tsx
│   └── priority-badge.tsx
├── lib/
│   ├── db.ts                 # Connessione database
│   ├── schema.ts             # Schema Drizzle
│   └── utils.ts              # Utility functions
├── types/
│   └── index.ts              # Tipi e validazione Zod
└── drizzle.config.ts         # Configurazione Drizzle Kit
```

## Comandi Disponibili

```bash
npm run dev          # Avvia in sviluppo
npm run build        # Build di produzione
npm run start        # Avvia in produzione
npm run lint         # Controllo lint
npm run db:generate  # Genera migrazioni
npm run db:push      # Pusha schema
npm run db:migrate   # Esegui migrazioni
npm run db:studio    # Apri Drizzle Studio
```

Per Allineare i menu
Esegui npm run menu:analyze (per vedere le differenze)
Esegui npm run menu:sync (per applicare le modifiche con conferme)