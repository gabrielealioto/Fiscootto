# Fiscootto

Controller finanziario per freelance in **regime forfettario**: registri entrate e uscite (a mano o importando il CSV della banca), vedi i numeri chiave e quanto accantonare per tasse e contributi, e con un clic ottieni un **report scritto dall'AI**: giornaliero, settimanale o mensile.

## Funzioni

- **Accesso con link via email** (Supabase Auth). Ogni utente vede solo i propri dati (Row Level Security).
- **Work / Life**: ogni movimento è dell'attività (Work) o personale (Life), con categorie proprie (casa, bollette, spesa, svago…). La dashboard ha la vista Work, Life o Tutto; tasse, contributi, IVA e report usano solo i movimenti Work.
- **Movimenti**: inserimento rapido, modifica (tocca un movimento) ed eliminazione.
- **Foto dello scontrino**: con `ANTHROPIC_API_KEY`, Claude legge importo, data, negozio, categoria e IVA dalla foto (`/api/receipt`) e precompila il modulo; senza chiave il pulsante non compare.
- **Categorie personalizzate e regole automatiche**: in *Impostazioni* aggiungi categorie Work o Life (con quota deducibile per il regime ordinario) e regole "se la descrizione contiene… allora categoria…", applicate all'import CSV e mentre scrivi.
- **Pianifica**: budget mensili per categoria con avvisi all'80% e al superamento; spese e incassi ricorrenti (abbonamenti, bollette, affitto) con scadenze, pulsante "Pagata" che registra il movimento e sposta la scadenza; obiettivi di risparmio con traguardo, data e quota mensile necessaria.
- **Avvisi nell'app**: budget, scadenze passate o vicine e obiettivi in ritardo compaiono in cima alla dashboard e in *Pianifica*.
- **Import CSV**: riconosce `data`, `descrizione`, `importo` (negativo = uscita) oppure le colonne separate `entrate`/`uscite`, più `categoria`. Accetta separatore `;` o `,`, importi nel formato italiano (`1.234,56`) e date `gg/mm/aaaa`. Salta le righe introduttive dell'estratto conto e i movimenti già importati, così si può ricaricare lo stesso file senza duplicati.
- **Dashboard** per giorno, settimana (da lunedì) o mese, con navigazione tra i periodi. Ogni voce ha un colore fisso in tutta l'app (entrate blu, uscite arancio, profitti verde acqua, tasse magenta, scelti per essere distinguibili anche da chi è daltonico): entrate, uscite, utile con la variazione rispetto al periodo precedente, grafico degli ultimi 6 periodi, uscite per categoria.
- **Codice ATECO**: inserito in *Impostazioni*, imposta da solo il coefficiente di redditività secondo la tabella del forfettario (per i codici del commercio, cambiati con ATECO 2025, chiede di scegliere il gruppo). Il coefficiente resta modificabile.
- **Previdenza INPS (valori 2026)**: Gestione Separata (26,07%, oppure 24% per pensionati o iscritti ad altra previdenza, massimale 122.295 €), Artigiani e Commercianti (contributi fissi sul minimale di 18.808 €, 24% / 24,48% sull'eccedenza, 25% / 25,48% oltre 56.224 €, riduzione del 35% per i forfettari), cassa professionale con aliquota libera. I contributi fissi sono ripartiti sui giorni dell'anno. Fonti: circolari INPS n. 8 e n. 14 del 2026.
- **Regime ordinario o semplificato** (in alternativa al forfettario): ogni movimento ha la sua aliquota IVA (22/10/5/4%/esente, proposta per categoria); le spese si deducono con i limiti di legge (materiali e prodotti di consumo e merci per la rivendita 100%, telefono 80%, vitto e alloggio 75%, auto 20% con IVA al 40%, beni strumentali oltre 516,46 € con ammortamento al 20%); la stima comprende contributi INPS sul reddito, IRPEF 2026 a scaglioni (23% / 33% / 43%), addizionali regionale e comunale e IVA da versare. Niente detrazioni personali né rimanenze: è una stima per l'accantonamento.
- **Stima fiscale forfettario**: imponibile = incassi × coefficiente; contributi INPS secondo la gestione; imposta sostitutiva su (imponibile − contributi). Mostrata sia per il periodo sia da inizio anno. Parametri modificabili in *Impostazioni* (predefiniti: coefficiente 78%, INPS gestione separata 26,07%, imposta 15%).
- **Report AI** (`/api/report`): il server calcola gli aggregati, li manda a Claude con un prompt da controller e salva il testo nella tabella `reports`. Il report si può copiare o scaricare in `.md`; lo storico è in *Report salvati*. Modello predefinito `claude-opus-5-5` (modificabile con `ANTHROPIC_MODEL`); se il modello declina la richiesta, l'API ripiega automaticamente su un modello di riserva.
  - **Senza chiave Anthropic** l'app funziona lo stesso: il pulsante genera un *report automatico* gratuito, con le stesse sezioni, calcolato dai numeri con regole fisse. Basta aggiungere `ANTHROPIC_API_KEY` per passare al report scritto da Claude.

- **App installabile (PWA)**: si installa dal browser con icona propria e finestra a tutto schermo.
  - Android / Chrome / Edge su PC: pulsante **⬇ Installa app** in alto, oppure menu del browser → *Installa app*.
  - iPhone / iPad: Safari → *Condividi* → *Aggiungi alla schermata Home*.
  - Senza rete mostra una pagina offline. In cache finiscono solo i file statici (JS, CSS, icone): pagine con dati finanziari e API non vengono mai salvate sul dispositivo, e all'uscita la cache viene svuotata.

> Le stime fiscali sono indicative e non sostituiscono il commercialista.

> L'installazione richiede HTTPS: funziona su `localhost` in sviluppo e sul dominio Vercel in produzione. Il service worker si attiva solo con `npm run build && npm start` o in produzione, non con `npm run dev`.

## Stack

Next.js 15 (App Router) · Supabase (Postgres + Auth) · Anthropic API · nessuna libreria grafica (SVG puro).

```
app/
  page.tsx               dashboard
  login/                 accesso con link email
  auth/callback|signout  sessione
  reports/               storico report
  settings/              parametri forfettario
  api/report/route.ts    generazione report con Claude
components/              Dashboard, grafici SVG, finestre (nuovo movimento, import), navigazione, PWA, mini renderer Markdown
public/                  service worker, pagina offline, icone
app/manifest.ts          manifest della PWA
lib/finance.ts           calcoli (periodi, aggregati, tasse, parser CSV) + test
lib/ateco.ts             codice ATECO → coefficiente di redditività + test
lib/inps.ts              gestioni INPS 2026 e calcolo dei contributi + test
lib/ordinario.ts         regime ordinario: IVA, deducibilità, IRPEF 2026 + test
lib/planning.ts          Work/Life, regole, ricorrenze, budget, obiettivi, avvisi + test
app/pianifica/           budget, ricorrenti e obiettivi
app/api/receipt/         lettura degli scontrini con Claude
lib/report.ts            prompt del report + test
lib/data.ts              lettura movimenti e impostazioni da Supabase
lib/supabase/            client Supabase (server, browser, middleware)
middleware.ts            rinnovo sessione e protezione delle pagine
app/actions.ts           server action: movimenti, import CSV, impostazioni
supabase/migrations/     schema SQL con RLS
```

## Avvio in locale

1. **Supabase**: crea un progetto, poi apri *SQL Editor* ed esegui in ordine i file di `supabase/migrations/` (`0001_init.sql`, `0002_ateco.sql`, `0003_gestione_inps.sql`, `0004_regime_ordinario.sql`, `0005_pianificazione.sql`, `0006_ambito_work_life.sql`).
   In *Authentication → URL Configuration* aggiungi `http://localhost:3000/auth/callback` (e poi l'URL di produzione) tra i Redirect URL.
2. **Variabili d'ambiente**: copia `.env.example` in `.env.local` e compila URL e chiave anon di Supabase e, se vuoi il report scritto dall'AI, la chiave `ANTHROPIC_API_KEY` (facoltativa).
3. Avvia:
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   npm test        # test della logica di calcolo e del prompt
   ```

## Messa online (Vercel)

Importa il repository GitHub su Vercel, aggiungi le stesse variabili d'ambiente e fai il deploy. Il file `vercel.json` imposta già il framework su Next.js; se il progetto Vercel è stato creato quando il repository era vuoto, controlla comunque in *Settings → Build and Deployment* che *Framework Preset* sia **Next.js** e che *Output Directory* non sia sovrascritta. Lascia disattivata la *Vercel Authentication* (Settings → Deployment Protection) sul dominio di produzione: l'app ha già il suo login. Poi aggiungi `https://<tuo-dominio>/auth/callback` ai Redirect URL di Supabase.

## Prossimi passi

- Stripe: abbonamento con prova di 7 giorni e blocco dell'accesso per chi non paga.
- Invio automatico del report via email (cron di Vercel + Resend).
- Esportazione in PDF.
- Categorie personalizzabili e regole di categorizzazione automatica per il CSV.
