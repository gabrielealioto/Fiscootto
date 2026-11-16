import { GESTIONE_INFO } from "./inps";
import {
  byCategory,
  formatEur,
  formatPct,
  longLabel,
  type Period,
  type PeriodSummary,
  type TaxSettings,
  type Transaction,
  inRange,
} from "./finance";

export const REPORT_SYSTEM_PROMPT = `Sei il controller finanziario di un freelance italiano in regime forfettario.
Scrivi report brevi, concreti e leggibili da chi non è un esperto di contabilità.

Regole:
- Usa solo i numeri forniti nei dati. Non inventare cifre, clienti o scadenze. Se un dato manca, dillo.
- Nel forfettario i costi NON riducono le tasse: imposta e contributi dipendono solo dagli incassi
  (artigiani e commercianti pagano anche contributi fissi, dovuti anche senza incassi).
  Le uscite contano per l'utile reale e la liquidità, non per il fisco.
- Le stime fiscali sono indicative: ricordalo in una riga, senza ripeterlo più volte.
- Tono diretto, da consulente. Niente frasi di circostanza, niente emoji.
- Formato Markdown con queste sezioni, in quest'ordine:
  ## Sintesi (2-3 frasi: come è andato il periodo)
  ## Numeri chiave (elenco puntato con entrate, uscite, utile e variazioni)
  ## Cosa è cambiato (confronto con il periodo precedente e con la tendenza degli ultimi periodi)
  ## Uscite (dove vanno i soldi, voci anomale o da tenere d'occhio)
  ## Tasse e contributi (quanto accantonare per il periodo e da inizio anno)
  ## Azioni consigliate (al massimo 3 azioni concrete e numerate)
- Lunghezza: report giornaliero circa 150 parole, settimanale circa 250, mensile circa 400.`;

const PERIOD_NAME: Record<Period, string> = {
  giorno: "giornaliero",
  settimana: "settimanale",
  mese: "mensile",
};

/** Dati del periodo in forma testuale e compatta: è tutto ciò che vede il modello. */
export function buildReportPrompt(summary: PeriodSummary, txs: Transaction[], settings: TaxSettings): string {
  const { period, range, previousRange, current, previous, change, tax, taxYtd } = summary;
  const label = longLabel(period, range);
  const lines: string[] = [];

  lines.push(`Report ${PERIOD_NAME[period]} — ${label} (${range.start} → ${range.end})`);
  lines.push("");
  lines.push("## Periodo corrente");
  lines.push(`- Entrate: ${formatEur(current.entrate)} (vs periodo precedente: ${formatPct(change.entrate)})`);
  lines.push(`- Uscite: ${formatEur(current.uscite)} (${formatPct(change.uscite)})`);
  lines.push(`- Utile: ${formatEur(current.utile)} (${formatPct(change.utile)})`);
  lines.push(`- Movimenti registrati: ${current.movimenti}`);
  lines.push("");
  lines.push(`## Periodo precedente (${longLabel(period, previousRange)})`);
  lines.push(`- Entrate: ${formatEur(previous.entrate)} · Uscite: ${formatEur(previous.uscite)} · Utile: ${formatEur(previous.utile)}`);
  lines.push("");
  lines.push("## Ultimi periodi (dal più vecchio)");
  for (const h of summary.history) {
    lines.push(`- ${h.label}: entrate ${formatEur(h.totals.entrate)}, uscite ${formatEur(h.totals.uscite)}, utile ${formatEur(h.totals.utile)}`);
  }
  lines.push("");
  lines.push("## Uscite per categoria (periodo corrente)");
  if (summary.categories.length === 0) lines.push("- Nessuna uscita");
  for (const c of summary.categories) lines.push(`- ${c.category}: ${formatEur(c.amount)}`);
  lines.push("");
  lines.push("## Entrate per categoria (periodo corrente)");
  if (summary.incomeCategories.length === 0) lines.push("- Nessuna entrata");
  for (const c of summary.incomeCategories) lines.push(`- ${c.category}: ${formatEur(c.amount)}`);
  lines.push("");

  const inPeriod = txs.filter((t) => inRange(t, range));
  const top = (kind: "entrata" | "uscita") =>
    inPeriod
      .filter((t) => t.kind === kind)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  lines.push("## Movimenti più grandi del periodo");
  for (const t of [...top("entrata"), ...top("uscita")]) {
    lines.push(`- ${t.date} · ${t.kind} · ${formatEur(t.amount)} · ${t.category}${t.description ? ` · ${t.description}` : ""}`);
  }
  if (inPeriod.length === 0) lines.push("- Nessun movimento");
  lines.push("");

  const pct = (n: number) => `${(n * 100).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;
  lines.push("## Parametri fiscali");
  lines.push(
    `- Coefficiente di redditività ${pct(settings.coefficiente)} · previdenza: ${GESTIONE_INFO[settings.gestione ?? "separata"].label}, aliquota ${pct(settings.aliquota_contributi)}${settings.riduzione_35 ? " con riduzione del 35%" : ""} · imposta sostitutiva ${pct(settings.aliquota_imposta)}`,
  );
  lines.push("");
  lines.push("## Stima fiscale del periodo (sugli incassi del periodo)");
  lines.push(
    `- Imponibile ${formatEur(tax.imponibile)} · contributi ${formatEur(tax.contributi)}${tax.contributiFissi > 0 ? ` (di cui fissi ${formatEur(tax.contributiFissi)})` : ""} · imposta ${formatEur(tax.imposta)} · da accantonare ${formatEur(tax.totale)} (${pct(tax.quotaSuIncassi)} degli incassi)`,
  );
  lines.push(`## Stima fiscale da inizio anno (${taxYtd.yearStart} → ${range.end})`);
  lines.push(
    `- Incassi ${formatEur(taxYtd.incassi)} · imponibile ${formatEur(taxYtd.imponibile)} · contributi ${formatEur(taxYtd.contributi)} · imposta ${formatEur(taxYtd.imposta)} · da accantonare ${formatEur(taxYtd.totale)}`,
  );
  lines.push("");
  lines.push(`Scrivi ora il report ${PERIOD_NAME[period]}.`);
  return lines.join("\n");
}

// ─── Report automatico (senza AI, gratuito) ────────────────────

export const BASIC_MODEL = "automatico";

const PERIOD_ARTICLE: Record<Period, string> = { giorno: "la giornata", settimana: "la settimana", mese: "il mese" };
/** "rispetto a ..." con la preposizione articolata giusta. */
const VS_PREV: Record<Period, string> = { giorno: "rispetto a ieri", settimana: "rispetto alla settimana precedente", mese: "rispetto al mese precedente" };

/**
 * Report scritto con regole fisse a partire dagli stessi numeri del report AI.
 * Usato quando ANTHROPIC_API_KEY non è configurata: nessun costo.
 */
export function buildBasicReport(summary: PeriodSummary, txs: Transaction[]): string {
  const { period, range, previousRange, current, previous, change, tax, taxYtd } = summary;
  const eur = formatEur;
  const pctOf = (part: number, whole: number) =>
    whole > 0 ? `${Math.round((part / whole) * 100).toLocaleString("it-IT")}%` : "—";
  const out: string[] = [];

  // Sintesi
  out.push("## Sintesi");
  if (current.movimenti === 0) {
    out.push(`Nessun movimento registrato per ${longLabel(period, range)}. Se hai incassato o speso qualcosa, aggiungilo o importa il CSV della banca.`);
  } else {
    const esito =
      current.utile > 0
        ? `si chiude in positivo con un utile di ${eur(current.utile)}`
        : current.utile < 0
          ? `si chiude in perdita di ${eur(Math.abs(current.utile))}: le spese hanno superato gli incassi`
          : "si chiude in pareggio";
    const confronto =
      change.entrate === null
        ? previous.entrate === 0 && current.entrate > 0
          ? ` ${capitalize(VS_PREV[period])}, quando non c'erano incassi, è un passo avanti.`
          : ""
        : ` Gli incassi sono ${change.entrate >= 0 ? "cresciuti" : "calati"} del ${formatPct(Math.abs(change.entrate)).replace("+", "")} ${VS_PREV[period]}.`;
    out.push(`${capitalize(PERIOD_ARTICLE[period])} di ${longLabel(period, range)} ${esito}.${confronto}`);
  }
  out.push("");

  // Numeri chiave
  out.push("## Numeri chiave");
  out.push(`- **Entrate:** ${eur(current.entrate)} (${formatPct(change.entrate)} vs ${eur(previous.entrate)})`);
  out.push(`- **Uscite:** ${eur(current.uscite)} (${formatPct(change.uscite)} vs ${eur(previous.uscite)})`);
  out.push(`- **Utile:** ${eur(current.utile)} (${formatPct(change.utile)} vs ${eur(previous.utile)})`);
  out.push(`- **Movimenti:** ${current.movimenti}`);
  out.push("");

  // Cosa è cambiato
  out.push("## Cosa è cambiato");
  const earlier = summary.history.slice(0, -1).filter((h) => h.totals.movimenti > 0);
  if (earlier.length === 0) {
    out.push("Non ci sono ancora abbastanza periodi precedenti per vedere una tendenza.");
  } else {
    const avgIn = earlier.reduce((s, h) => s + h.totals.entrate, 0) / earlier.length;
    const avgOut = earlier.reduce((s, h) => s + h.totals.uscite, 0) / earlier.length;
    const best = [...summary.history].sort((a, b) => b.totals.entrate - a.totals.entrate)[0];
    out.push(`- Media incassi dei periodi precedenti: ${eur(avgIn)}; questo periodo: ${eur(current.entrate)} (${current.entrate >= avgIn ? "sopra" : "sotto"} la media).`);
    out.push(`- Media spese dei periodi precedenti: ${eur(avgOut)}; questo periodo: ${eur(current.uscite)} (${current.uscite <= avgOut ? "sotto" : "sopra"} la media).`);
    if (best.totals.entrate > 0) out.push(`- Periodo migliore per incassi negli ultimi ${summary.history.length}: ${best.label} con ${eur(best.totals.entrate)}.`);
  }
  out.push("");

  // Uscite
  out.push("## Uscite");
  const inPeriod = txs.filter((t) => inRange(t, range));
  const prevCats = new Map(byCategory(txs, previousRange).map((c) => [c.category, c.amount]));
  let grown: { category: string; delta: number } | null = null;
  if (summary.categories.length === 0) {
    out.push("Nessuna uscita nel periodo.");
  } else {
    for (const c of summary.categories.slice(0, 3)) {
      out.push(`- ${c.category}: ${eur(c.amount)} (${pctOf(c.amount, current.uscite)} delle uscite)`);
    }
    const biggest = inPeriod.filter((t) => t.kind === "uscita").sort((a, b) => b.amount - a.amount)[0];
    if (biggest) out.push(`- Spesa più grande: ${eur(biggest.amount)}${biggest.description ? ` (${biggest.description})` : ""} il ${biggest.date.split("-").reverse().join("/")}.`);
    for (const c of summary.categories) {
      const delta = c.amount - (prevCats.get(c.category) ?? 0);
      if (delta > 0 && (!grown || delta > grown.delta)) grown = { category: c.category, delta };
    }
    if (grown && previous.uscite > 0) out.push(`- La voce cresciuta di più ${VS_PREV[period]}: ${grown.category} (+${eur(grown.delta)}).`);
    const top = summary.categories[0];
    if (summary.categories.length > 1 && top.amount / current.uscite > 0.5) {
      out.push(`- Attenzione: ${top.category} da sola vale più della metà delle spese.`);
    }
  }
  out.push("");

  // Tasse
  out.push("## Tasse e contributi");
  out.push(`- Per questo periodo metti da parte circa **${eur(tax.totale)}**: ${eur(tax.contributi)} di contributi INPS e ${eur(tax.imposta)} di imposta sostitutiva.`);
  if (tax.contributiFissi > 0) out.push(`- Nei contributi c'è la quota del periodo dei contributi fissi (${eur(tax.contributiFissi)}), dovuti anche senza incassi.`);
  out.push(`- Da inizio anno, su ${eur(taxYtd.incassi)} di incassi, il totale da accantonare è circa **${eur(taxYtd.totale)}**.`);
  out.push("- Nel forfettario le spese non riducono le tasse: contano solo gli incassi. Le stime sono indicative.");
  out.push("");

  // Azioni
  out.push("## Azioni consigliate");
  const actions: string[] = [];
  if (tax.totale > 0) actions.push(`Sposta ${eur(tax.totale)} su un conto separato per tasse e contributi.`);
  if (current.entrate === 0) actions.push("Nessun incasso nel periodo: controlla se ci sono fatture da emettere o pagamenti da sollecitare.");
  if (current.utile < 0) actions.push("Le spese superano gli incassi: rivedi le uscite non indispensabili.");
  if (grown && grown.delta > 0 && previous.uscite > 0 && change.uscite !== null && change.uscite > 20) {
    actions.push(`Le uscite sono salite del ${formatPct(change.uscite).replace("+", "")}: verifica le spese di ${grown.category}.`);
  }
  if (actions.length < 3) actions.push("Registra o importa tutti i movimenti con regolarità, così i numeri restano affidabili.");
  actions.slice(0, 3).forEach((a, i) => out.push(`${i + 1}. ${a}`));
  out.push("");
  out.push("---");
  out.push("_Report automatico generato senza AI. Aggiungi una chiave Anthropic per un'analisi scritta da Claude._");
  return out.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
