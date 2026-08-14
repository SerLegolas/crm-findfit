# Configurazione Menu — CRM FindFit

Fonte di verità per i permessi menu del CRM. Mantenuta sincronizzata con:
- `components/sidebar.tsx` (voci menu mostrate)
- `app/api/auth/register/route.ts` (default per i nuovi account: `features` e `featuresAdmin`)
- `app/superuser/admin/[id]/page.tsx` (checkbox per il superuser)
- DB `company_rules` (stato effettivo per ogni azienda)

> Gestione tramite `npm run menu:analyze` (analisi), `npm run menu:sync` (sincronizza) e `npm run menu:status` (stato attuale).

## Moduli (features)

Moduli attivabili per azienda (modello opt-in: visibili solo se `true`).

- dashboard: Dashboard
- clienti: Clienti
- kanban: Kanban
- task: Task
- note: Note
- email: Email
- analisi: Analisi
- template: Template
- comunicazioni: Comunicazioni
- impostazioni: Impostazioni

## Moduli Admin (featuresAdmin)

Funzionalità admin opzionali per azienda (modello opt-in).

- gestione_utenti: Gestione Utenti
- configurazione_email: Configurazione Email
- recupero_email: Recupero Email
- facebook_post: Facebook Post
