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
  "/kanban": "Guida in fase di scrittura per questa pagina.",
  "/clienti": "Guida in fase di scrittura per questa pagina.",
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
