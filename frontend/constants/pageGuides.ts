/**
 * Guide interattive per le pagine del CRM.
 * Ogni chiave è un pathname (es. "/comunicazioni") e il valore è il testo
 * della guida in formato Markdown (rende: titoli, grassetto, elenchi,
 * tabelle, citazioni). I testi sono mostrati nel Dialog di PageGuide.
 */
export const pageGuides: Record<string, string> = {
  "/comunicazioni": `## 📘 Guida Pagina "Comunicazioni"

### A cosa serve

La pagina **Comunicazioni** permette di **programmare invii automatici di email** a gruppi di clienti.  
È il cuore delle attività di **marketing automatizzato** del CRM.

---

### Come si usa

#### 1. Creare una nuova comunicazione

- Clicca su **"Nuova Comunicazione"**.
- Compila i campi:
  - **Titolo**: nome descrittivo per riconoscere la comunicazione.
  - **Template**: scegli il modello email da utilizzare.
  - **Analisi**: seleziona un gruppo di clienti salvato in precedenza.
  - **Data di invio**: seleziona il giorno in cui il cron esterno invierà le email (sempre alle **08:00** del fuso orario impostato).
- Clicca **"Programma"** per salvare.

> ⚠️ **Nota:** Non è possibile avere due comunicazioni attive per la stessa data. Il calendario le disabilita automaticamente.

---

#### 2. Gestire le comunicazioni programmate

La tabella elenca tutte le comunicazioni con:

- **Titolo**, **Template**, **Analisi** e **Data invio**.
- **Stato**: 
  - *Programmata* → in attesa di invio.
  - *In elaborazione* → il cron sta elaborando gli invii.
  - *Inviata* → tutte le email sono state spedite.
  - *Inviata parziale* → solo una parte dei clienti ha ricevuto l'email.
  - *Fallita* → nessuna email è stata inviata.
  - *Annullata* → comunicazione disattivata manualmente.
- **Riepilogo**: conteggio inviati/falliti/in attesa.

---

#### 3. Azioni disponibili (colonna "Azioni")

| Icona | Funzione | Quando è disponibile |
|-------|----------|----------------------|
| 👁️ Occhio | **Dettaglio invii** – mostra l'elenco dei clienti con stato di invio e tracking (consegnata/aperta). | Sempre. |
| ✏️ Matita | **Modifica** – cambia titolo, template, analisi o data. | Solo se lo stato è *Programmata*. |
| 🚫 Divieto | **Annulla** – blocca definitivamente la comunicazione. | Solo se lo stato è *Programmata*. |
| 🗑️ Cestino | **Elimina** – rimuove la comunicazione e i relativi invii (irreversibile). | Solo se non in elaborazione. |

---

### Regole importanti

- **L'annullamento è definitivo:** una volta annullata, la comunicazione non può essere riattivata. Dovrai crearne una nuova.
- **Non modificare le comunicazioni in elaborazione:** il pulsante di modifica è disabilitato quando il cron è in esecuzione (lock attivo).
- **I template e le analisi** devono essere già stati creati nelle rispettive pagine (Template Salvati e Analisi Salvate).

---

### Suggerimenti

- Usa il pulsante **Aggiorna** per ricaricare la tabella e vedere gli stati più recenti.
- Per testare gli invii manualmente (es. in sviluppo), puoi usare il link "Esegui invio manuale (cron)" visibile in fondo al form.
- Tieni traccia delle date programmate per evitare sovrapposizioni.
`,

  // ── Altre pagine: placeholder ──
  "/dashboard": "Guida in fase di scrittura per questa pagina.",
  "/kanban": `## 📘 Guida Pagina "Trattative"

### A cosa serve

La pagina **Trattative** ti permette di gestire lo stato di avanzamento dei tuoi clienti attraverso un sistema di **colonne trascinabili**.
Visualizzi i clienti divisi per fase del processo di vendita: Lead, Suspect, Won e Closed Lost.

---

### Come si usa

#### 1. Trascinare un cliente tra le colonne

- Trova il cliente nella colonna corrispondente al suo stato attuale.
- **Trascina** la scheda del cliente verso la colonna di destinazione.
- Rilascia per aggiornare automaticamente lo status.

> ⚠️ **Nota:** Le transizioni tra colonne seguono le regole del processo di vendita:
> - **Lead** → può andare a *Suspect*, *Won* o *Closed Lost*.
> - **Suspect** → può tornare a *Lead*, andare a *Won* o *Closed Lost*.
> - **Won** → non può essere spostato (il ciclo di vendita è completato).
> - **Closed Lost** → può essere riportato a *Lead*, *Suspect* o *Won*.

---

#### 2. Chiudere un cliente (Closed Lost)

- Quando trascini un cliente in **Closed Lost**, viene richiesta una **nota obbligatoria**.
- Inserisci il motivo della chiusura nel dialog che appare.
- La nota viene salvata automaticamente come "decisione" nella cronologia del cliente.

---

#### 3. Filtrare per assegnazione (solo Admin)

- Se sei **Amministratore**, puoi filtrare i clienti per utente assegnato.
- Usa il dropdown **"Assegnato a"** in alto a destra.
- Seleziona un utente specifico per vedere solo i suoi clienti.

---

#### 4. Navigazione e dettagli cliente

- **Clicca** su una qualsiasi scheda cliente per andare alla pagina di dettaglio.
- Da lì puoi gestire note, task, email e aggiornare i dati anagrafici.

---

### Suggerimenti

- **Stato delle colonne**: ogni colonna mostra il numero totale di clienti che contiene.
- **Paginazione**: se una colonna ha più di 20 clienti, usa i pulsanti "Precedente" / "Successiva" in fondo per navigare.
- **Trascina con precisione**: assicurati di rilasciare la scheda all'interno della colonna di destinazione (evidenziata in blu quando il trascinamento è attivo).

---

### Regole importanti

- **Solo transizioni consentite**: se provi a fare una mossa non permessa, vedrai un messaggio di errore.
- **Nota per Closed Lost**: obbligatoria per tracciare il motivo della perdita del cliente. Non puoi chiudere senza nota.
- **I dati vengono sincronizzati** immediatamente con il database: non è necessario salvare manualmente.
`,
  "/clienti": `## 📘 Guida Pagina "Lista Clienti"

### A cosa serve

La pagina **Lista Clienti** è il punto centrale per la gestione anagrafica di tutti i tuoi contatti. Da qui puoi visualizzare, cercare, filtrare, creare, modificare ed eliminare i clienti.

---

### Come si usa

#### 1. Visualizzare la lista

- La tabella mostra tutti i clienti della tua azienda.
- Ogni riga contiene: **Status**, **Azienda** / **Nome**, **Contatti** (email/telefono), **Assegnato a**, **Consenso email**.
- **Clicca** su una riga per aprire la pagina di dettaglio del cliente.

---

#### 2. Cercare e filtrare

- **Ricerca libera**: usa il campo di ricerca in alto per trovare clienti per nome, email o azienda.
- **Filtro per Status**: seleziona uno status specifico (Lead, Suspect, Won, Closed Lost).
- **Filtro per Categoria**: scegli una categoria (Palestra, PT, Piscina, ecc.).
- **Filtro per Consenso**: mostra solo i clienti che hanno acconsentito (✅) o meno (❌) a ricevere email.
- **Filtro per Assegnazione** (solo Admin): filtra per utente assegnato.

> 💡 I filtri si applicano automaticamente quando cambi selezione.

---

#### 3. Creare un nuovo cliente

- Clicca sul pulsante **"Nuovo cliente"** (icona +).
- Compila i campi obbligatori: **Nome** ed **Email**.
- Compila i campi opzionali: Telefono, Azienda, Categoria, Status, Note.
- Clicca **"Crea cliente"** per salvare.

> ⚠️ **Nota:** Se selezioni lo status *Suspect* o *Won*, verranno creati automaticamente task di follow-up (es. "Chiamata qualificazione" per Suspect, "Invia contratto" per Won).

---

#### 4. Modificare un cliente

- Clicca sull'icona **✏️ (Matita)** nella colonna "Azioni".
- Aggiorna i campi desiderati.
- Clicca **"Salva modifiche"**.

---

#### 5. Eliminare un cliente

- Clicca sull'icona **🗑️ (Cestino)** nella colonna "Azioni".
- Conferma l'eliminazione nel dialog di conferma.

> ⚠️ **Attenzione:** L'eliminazione è irreversibile e cancella anche tutte le note, i task e le email associate al cliente.

---

### Funzionalità speciali

#### Consenso email (Opt-out)

- I clienti hanno un flag **"Consenso"** che indica se possono ricevere email.
- **Admin** può modificare questo flag dal dettaglio cliente.
- Se un cliente si disiscrive tramite il link nelle email, il flag viene automaticamente impostato su **❌**.

#### Assegnazione a utenti (solo Admin)

- Gli Admin possono assegnare un cliente a un utente specifico della propria azienda.
- I clienti **non assegnati** sono visibili a tutti.

---

### Suggerimenti

- Usa la **ricerca combinata con i filtri** per trovare rapidamente gruppi di clienti (es. tutti i Lead di categoria "Palestra").
- La **paginazione** mostra 10 clienti per pagina: usa i pulsanti "Precedente" / "Successiva" per navigare.
- Clicca sul nome del cliente nella tabella per accedere alla **pagina di dettaglio**, dove puoi gestire note, task ed email.

---

### Regole importanti

- **Email univoca**: non è possibile avere due clienti con la stessa email.
- **Campi obbligatori**: alla creazione sono obbligatori **Nome** ed **Email**. Tutti gli altri sono opzionali.
- **Accesso ai dati**: gli utenti con ruolo "user" vedono solo i clienti **assegnati a loro** o **non assegnati**. Gli Admin vedono tutti i clienti dell'azienda.
`,
  "/task-calendar": "Guida in fase di scrittura per questa pagina.",
  "/task": "Guida in fase di scrittura per questa pagina.",
  "/note": "Guida in fase di scrittura per questa pagina.",
  "/analisi": "Guida in fase di scrittura per questa pagina.",
  "/analisi-salvate": "Guida in fase di scrittura per questa pagina.",
  "/template-nuovo": "Guida in fase di scrittura per questa pagina.",
  "/template-salvati": "Guida in fase di scrittura per questa pagina.",
  "/impostazioni": "Guida in fase di scrittura per questa pagina.",
};

/** Testo placeholder predefinito per le pagine non ancora documentate. */
export const PLACEHOLDER_GUIDE = "Guida in fase di scrittura per questa pagina.";
