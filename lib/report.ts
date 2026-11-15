import {
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
- Nel forfettario i costi NON riducono le tasse: imposta e contributi dipendono solo dagli incassi.
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
    `- Coefficiente di redditività ${pct(settings.coefficiente)} · contributi INPS ${pct(settings.aliquota_contributi)} · imposta sostitutiva ${pct(settings.aliquota_imposta)}`,
  );
  lines.push("");
  lines.push("## Stima fiscale del periodo (sugli incassi del periodo)");
  lines.push(
    `- Imponibile ${formatEur(tax.imponibile)} · contributi ${formatEur(tax.contributi)} · imposta ${formatEur(tax.imposta)} · da accantonare ${formatEur(tax.totale)} (${pct(tax.quotaSuIncassi)} degli incassi)`,
  );
  lines.push(`## Stima fiscale da inizio anno (${taxYtd.yearStart} → ${range.end})`);
  lines.push(
    `- Incassi ${formatEur(taxYtd.incassi)} · imponibile ${formatEur(taxYtd.imponibile)} · contributi ${formatEur(taxYtd.contributi)} · imposta ${formatEur(taxYtd.imposta)} · da accantonare ${formatEur(taxYtd.totale)}`,
  );
  lines.push("");
  lines.push(`Scrivi ora il report ${PERIOD_NAME[period]}.`);
  return lines.join("\n");
}
