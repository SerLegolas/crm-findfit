# CRM FindFit

Sistema CRM professionale **monorepo (npm workspaces)** basato su Next.js 14+, Turso (SQLite) e Drizzle ORM.

## Stack Tecnologico

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Database**: Turso (SQLite edge database)
- **ORM**: Drizzle ORM
- **Validazione**: Zod
- **Drag & Drop**: @hello-pangea/dnd
- **Deploy**: Vercel (root di progetto Next = `frontend/`)

## Struttura del Monorepo

```
crm-findfit/
├── frontend/                # Workspace: applicazione Next.js full-stack
│   ├── app/                 # App Router
│   │   ├── (dashboard)/     # Pagine (dashboard, clienti, kanban, task, note…)
│   │   ├── api/             # API route (backend attuale: auth, clients, email, …)
│   │   ├── login/ register/ superuser/
│   ├── components/          # Componenti React + shadcn/ui
│   ├── lib/                 # Logica server/DB (db.ts, schema.ts, auth.ts, …)
│   ├── types/               # Tipi condivisi e validazione Zod
│   ├── public/  constants/  scripts/  drizzle/
│   ├── middleware.ts  drizzle.config.ts  next.config.js …
│   └── package.json         # Dipendenze + script dell'app Next
├── backend/                 # Workspace (skeleton): src/{routes,controllers,…}
│                            # NOTA: la logica server oggi vive in frontend/app/api
├── shared/                  # Workspace: tipi/utility condivise (src/{types,lib})
├── scripts-test/            # Script di test/verifica (utils)
├── package.json             # Orchestratore monorepo (npm workspaces)
└── .github/menu-config.md   # Configurazione canonica dei menu (usata da menu-sync)
```

> Il workspace `frontend` contiene tutto il necessario per girare l'app Next (incluso
> `lib/`, `scripts/`, `drizzle/` e le migrazioni): è un'app full-stack autocontenuta.
> Le API route in `frontend/app/api` sono il backend attuale; `backend/` è pronto per
> un futuro servizio separato.

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

# Installa le dipendenze (monorepo: un unico node_modules alla root)
npm install

# Configura le variabili d'ambiente (le legge l'app Next in frontend/)
cp .env.example frontend/.env.local   # oppure copia il tuo .env.local esistente in frontend/
```

### Configurazione Database Turso

```bash
npm install -g turso
turso auth login
turso db create crm-findfit
turso db show crm-findfit --url
turso db tokens create crm-findfit

# Aggiorna frontend/.env.local
# TURSO_DB_URL=<url-ottenuto>
# TURSO_AUTH_TOKEN=<token-ottenuto>
```

### Esegui le migrazioni

Le migrazioni vivono nel workspace `frontend` (schema in `frontend/lib/schema.ts`).
Dalla root del monorepo gli script delegano automaticamente:

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
```

## Comandi Disponibili (dalla root)

```bash
npm run dev              # Avvia frontend + backend insieme (concurrently)
npm run dev:frontend     # Solo l'app Next (frontend)
npm run dev:backend      # Solo backend (placeholder)
npm run build            # Build di tutti i workspace che la supportano
npm run lint             # Lint di tutti i workspace
npm run menu:analyze     # Analizza differenze menu (sidebar/register/config/DB)
npm run menu:sync        # Applica le modifiche menu con conferme
npm run db:generate      # Genera migrazioni Drizzle (workspace frontend)
```

In alternativa puoi entrare nel workspace ed eseguire i comandi direttamente:

```bash
cd frontend
npm run dev
```

L'applicazione sarà disponibile su [http://localhost:3000](http://localhost:3000).

## Deploy su Vercel

1. Crea un repository su GitHub e carica il codice
2. Connetti il repository a [Vercel](https://vercel.com)
3. Imposta **Root Directory** su `frontend`
4. Imposta le variabili d'ambiente in Vercel:
   - `TURSO_DB_URL`
   - `TURSO_AUTH_TOKEN`
5. Deploy!

## Variabili d'Ambiente

```env
TURSO_DB_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```
