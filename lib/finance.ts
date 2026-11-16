import { fixedContributionsYear, variableContributions, type Gestione } from "./inps";

// Logica pura (nessuna dipendenza da Next o Supabase): periodi, aggregati,
// stima fiscale del regime forfettario e parser CSV. Testata in finance.test.ts.

export type Period = "giorno" | "settimana" | "mese";
export type Kind = "entrata" | "uscita";

export const PERIODS: Period[] = ["giorno", "settimana", "mese"];

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  kind: Kind;
  amount: number; // sempre positivo
  category: string;
  description: string;
}

export interface TaxSettings {
  coefficiente: number; // es. 0.78
  aliquota_contributi: number; // es. 0.2607
  aliquota_imposta: number; // 0.15 oppure 0.05
  gestione?: Gestione; // predefinita: Gestione Separata
  riduzione_35?: boolean; // riduzione contributiva per forfettari artigiani e commercianti
}

export const DEFAULT_SETTINGS: TaxSettings = {
  coefficiente: 0.78,
  aliquota_contributi: 0.2607,
  aliquota_imposta: 0.15,
  gestione: "separata",
  riduzione_35: false,
};

export const CATEGORIES: Record<Kind, string[]> = {
  entrata: ["Fatture", "Vendite", "Rimborsi", "Altro"],
  uscita: [
    "Software e abbonamenti",
    "Hardware",
    "Formazione",
    "Marketing",
    "Trasporti",
    "Telefono e internet",
    "Commercialista",
    "Tasse e contributi",
    "Banca",
    "Altro",
  ],
};

// ─── Date ──────────────────────────────────────────────────────
// Le date sono stringhe ISO "YYYY-MM-DD" trattate in UTC: niente sorprese
// con fusi orari e ora legale.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const d = toDate(s);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() + 1 === +m[2] && d.getUTCDate() === +m[3];
}

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Data di oggi nel fuso italiano. */
export function todayRome(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// ─── Periodi ───────────────────────────────────────────────────

export interface Range {
  start: string; // incluso
  end: string; // incluso
}

/** Periodo che contiene `ref`. La settimana parte dal lunedì. */
export function periodRange(period: Period, ref: string): Range {
  if (period === "giorno") return { start: ref, end: ref };
  const d = toDate(ref);
  if (period === "settimana") {
    const dow = (d.getUTCDay() + 6) % 7; // lunedì = 0
    const start = addDays(ref, -dow);
    return { start, end: addDays(start, 6) };
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { start: toIso(start), end: toIso(end) };
}

/** Periodo spostato di `n` unità (negativo = indietro). */
export function shiftPeriod(period: Period, ref: string, n: number): Range {
  if (period === "giorno") return periodRange(period, addDays(ref, n));
  if (period === "settimana") return periodRange(period, addDays(ref, 7 * n));
  const d = toDate(periodRange("mese", ref).start);
  d.setUTCMonth(d.getUTCMonth() + n);
  return periodRange(period, toIso(d));
}

/** Gli ultimi `count` periodi, dal più vecchio al più recente (incluso quello di `ref`). */
export function lastPeriods(period: Period, ref: string, count: number): Range[] {
  const out: Range[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftPeriod(period, ref, -i));
  return out;
}

/** Intervallo di date da caricare per mostrare un periodo: 6 periodi + anno in corso. */
export function dataRange(period: Period, ref: string, history = 6): Range {
  const current = periodRange(period, ref);
  const oldest = shiftPeriod(period, ref, -(history - 1)).start;
  const yearStart = `${current.end.slice(0, 4)}-01-01`;
  return { start: oldest < yearStart ? oldest : yearStart, end: current.end };
}

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MONTHS_LONG = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** Etichetta breve per il grafico. */
export function shortLabel(period: Period, range: Range): string {
  const d = toDate(range.start);
  if (period === "mese") return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Etichetta estesa per titoli e report. */
export function longLabel(period: Period, range: Range): string {
  const s = toDate(range.start);
  const e = toDate(range.end);
  if (period === "mese") return `${MONTHS_LONG[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  if (period === "giorno") return `${s.getUTCDate()} ${MONTHS_LONG[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

// ─── Aggregati ─────────────────────────────────────────────────

export interface Totals {
  entrate: number;
  uscite: number;
  utile: number;
  movimenti: number;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function inRange(t: Pick<Transaction, "date">, r: Range): boolean {
  return t.date >= r.start && t.date <= r.end;
}

export function totals(txs: Transaction[], r?: Range): Totals {
  let entrate = 0;
  let uscite = 0;
  let movimenti = 0;
  for (const t of txs) {
    if (r && !inRange(t, r)) continue;
    movimenti++;
    if (t.kind === "entrata") entrate += t.amount;
    else uscite += t.amount;
  }
  return { entrate: round2(entrate), uscite: round2(uscite), utile: round2(entrate - uscite), movimenti };
}

/** Uscite (o entrate) per categoria, ordinate dalla più alta. */
export function byCategory(txs: Transaction[], r: Range, kind: Kind = "uscita"): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.kind !== kind || !inRange(t, r)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/** Variazione percentuale; null se il periodo precedente è zero. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

export interface PeriodSummary {
  period: Period;
  range: Range;
  previousRange: Range;
  current: Totals;
  previous: Totals;
  change: { entrate: number | null; uscite: number | null; utile: number | null };
  history: { range: Range; label: string; totals: Totals }[];
  categories: { category: string; amount: number }[];
  incomeCategories: { category: string; amount: number }[];
  tax: TaxEstimate;
  taxYtd: TaxEstimate & { yearStart: string; incassi: number };
}

export function summarize(txs: Transaction[], period: Period, ref: string, settings: TaxSettings, historyCount = 6): PeriodSummary {
  const range = periodRange(period, ref);
  const previousRange = shiftPeriod(period, ref, -1);
  const current = totals(txs, range);
  const previous = totals(txs, previousRange);
  const yearStart = `${range.end.slice(0, 4)}-01-01`;
  const ytd = totals(txs, { start: yearStart, end: range.end });
  const year = Number(yearStart.slice(0, 4));
  const daysInYear = daysIn({ start: yearStart, end: `${year}-12-31` });
  // Parte del periodo che cade nell'anno fiscale (una settimana può iniziare a dicembre).
  const periodInYear: Range = { start: range.start < yearStart ? yearStart : range.start, end: range.end };
  const incassiPrima = periodInYear.start > yearStart ? totals(txs, { start: yearStart, end: addDays(periodInYear.start, -1) }).entrate : 0;
  return {
    period,
    range,
    previousRange,
    current,
    previous,
    change: {
      entrate: pctChange(current.entrate, previous.entrate),
      uscite: pctChange(current.uscite, previous.uscite),
      utile: pctChange(current.utile, previous.utile),
    },
    history: lastPeriods(period, ref, historyCount).map((r) => ({
      range: r,
      label: shortLabel(period, r),
      totals: totals(txs, r),
    })),
    categories: byCategory(txs, range, "uscita"),
    incomeCategories: byCategory(txs, range, "entrata"),
    tax: estimateTaxRange(incassiPrima, current.entrate, daysIn(periodInYear) / daysInYear, settings),
    taxYtd: {
      ...estimateTaxRange(0, ytd.entrate, daysIn({ start: yearStart, end: range.end }) / daysInYear, settings),
      yearStart,
      incassi: ytd.entrate,
    },
  };
}

// ─── Stima fiscale forfettario ─────────────────────────────────

export interface TaxEstimate {
  imponibile: number;
  contributi: number; // totale contributi INPS (fissi + in percentuale)
  contributiFissi: number; // quota dei contributi fissi (artigiani e commercianti)
  imposta: number;
  totale: number; // da accantonare
  quotaSuIncassi: number; // % degli incassi da accantonare (0..1)
}

/**
 * Stima per il regime forfettario:
 *  imponibile = incassi × coefficiente di redditività
 *  contributi = quanto la gestione INPS chiede su quell'imponibile (vedi lib/inps.ts):
 *               in percentuale (con massimale) e, per artigiani e commercianti,
 *               contributi fissi sul minimale e aliquota sull'eccedenza
 *  imposta    = (imponibile − contributi) × aliquota sostitutiva
 * Nella realtà i contributi si deducono per cassa nell'anno in cui si pagano:
 * è una stima prudenziale per l'accantonamento, non un calcolo dichiarativo.
 */
export function estimateTax(incassi: number, s: TaxSettings): TaxEstimate {
  return estimateTaxRange(0, incassi, 1, s);
}

/**
 * Stima per un periodo dentro l'anno fiscale.
 * - incassiPrima: incassi dell'anno prima dell'inizio del periodo (servono per minimale, soglie e massimale)
 * - incassi: incassi del periodo
 * - quotaAnno: frazione dell'anno coperta dal periodo, per ripartire i contributi fissi
 */
export function estimateTaxRange(incassiPrima: number, incassi: number, quotaAnno: number, s: TaxSettings): TaxEstimate {
  const prima = Math.max(0, incassiPrima) * s.coefficiente;
  const base = Math.max(0, incassi);
  const imponibile = base * s.coefficiente;
  const variabili = variableContributions(prima + imponibile, s) - variableContributions(prima, s);
  const fissi = fixedContributionsYear(s) * Math.min(1, Math.max(0, quotaAnno));
  const contributi = variabili + fissi;
  const imposta = Math.max(0, imponibile - contributi) * s.aliquota_imposta;
  const totale = contributi + imposta;
  return {
    imponibile: round2(imponibile),
    contributi: round2(contributi),
    contributiFissi: round2(fissi),
    imposta: round2(imposta),
    totale: round2(totale),
    quotaSuIncassi: base > 0 ? totale / base : 0,
  };
}

/** Giorni dell'intervallo (estremi inclusi). */
export function daysIn(r: Range): number {
  return Math.round((toDate(r.end).getTime() - toDate(r.start).getTime()) / 86_400_000) + 1;
}

// ─── Parser CSV ────────────────────────────────────────────────

export interface ParsedRow {
  date: string;
  kind: Kind;
  amount: number;
  category: string;
  description: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
  separator: ";" | ",";
}

/** Converte "1.234,56", "-12,50", "€ 1234.56", "1,234.56" in numero. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[€\s ']/g, "").replace(/EUR/i, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Il separatore che compare per ultimo è quello decimale.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    s = parts.length > 2 ? parts.join("") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    // Formato italiano: "1.234" o "1.234.567" sono migliaia.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0] !== "0")) s = parts.join("");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Converte "31/12/2025", "31-12-25", "31.12.2025", "2025-12-31" in ISO. */
export function parseDate(raw: string): string | null {
  const s = raw.trim().split(/[ T]/)[0];
  let y: number, m: number, d: number;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (match) {
    [y, m, d] = [+match[1], +match[2], +match[3]];
  } else {
    match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [+match[1], +match[2], +match[3]];
    if (y < 100) y += 2000;
  }
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

/** Divide una riga CSV rispettando le virgolette. */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Divide il testo in righe logiche (le virgolette possono contenere a capo). */
function splitLines(text: string): string[] {
  const lines: string[] = [];
  let cur = "";
  let quoted = false;
  for (const c of text.replace(/\r\n?/g, "\n")) {
    if (c === '"') quoted = !quoted;
    if (c === "\n" && !quoted) {
      lines.push(cur);
      cur = "";
    } else cur += c;
  }
  lines.push(cur);
  return lines.filter((l) => l.trim() !== "");
}

const norm = (h: string) =>
  h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["data", "date", "datacontabile", "dataoperazione", "datavaluta", "valuta"],
  description: ["descrizione", "description", "causale", "descrizioneoperazione", "dettaglio", "operazione", "note"],
  amount: ["importo", "amount", "importoeur", "ammontare", "valore"],
  income: ["entrate", "entrata", "avere", "accrediti", "accredito"],
  expense: ["uscite", "uscita", "dare", "addebiti", "addebito"],
  category: ["categoria", "category"],
};

function findColumn(headers: string[], key: string): number {
  const aliases = HEADER_ALIASES[key];
  const normalized = headers.map(norm);
  for (const a of aliases) {
    const i = normalized.indexOf(a);
    if (i >= 0) return i;
  }
  return -1;
}

export function detectSeparator(headerLine: string): ";" | "," {
  const count = (sep: string) => splitCsvLine(headerLine, sep).length;
  return count(";") >= count(",") ? ";" : ",";
}

export function parseCsv(text: string): ParseResult {
  const lines = splitLines(text.replace(/^﻿/, ""));
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["Il file è vuoto."], separator: ";" };

  // Alcune banche mettono righe di intestazione prima della tabella:
  // cerco la prima riga che contiene una colonna "data".
  let headerIdx = lines.findIndex((l) => findColumn(splitCsvLine(l, detectSeparator(l)), "date") >= 0);
  if (headerIdx < 0) headerIdx = 0;
  const separator = detectSeparator(lines[headerIdx]);
  const headers = splitCsvLine(lines[headerIdx], separator);

  const col = {
    date: findColumn(headers, "date"),
    description: findColumn(headers, "description"),
    amount: findColumn(headers, "amount"),
    income: findColumn(headers, "income"),
    expense: findColumn(headers, "expense"),
    category: findColumn(headers, "category"),
  };

  if (col.date < 0) errors.push('Colonna "data" non trovata.');
  if (col.amount < 0 && col.income < 0 && col.expense < 0) {
    errors.push('Serve una colonna "importo" oppure le colonne "entrate"/"uscite".');
  }
  if (errors.length) return { rows: [], errors, separator };

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], separator);
    const lineNo = i + 1;
    const get = (c: number) => (c >= 0 ? (cells[c] ?? "").trim() : "");

    const date = parseDate(get(col.date));
    if (!date) {
      errors.push(`Riga ${lineNo}: data non valida ("${get(col.date)}").`);
      continue;
    }

    let signed: number | null = null;
    if (col.amount >= 0 && get(col.amount) !== "") {
      signed = parseAmount(get(col.amount));
    } else {
      const inc = get(col.income) !== "" ? parseAmount(get(col.income)) : 0;
      const exp = get(col.expense) !== "" ? parseAmount(get(col.expense)) : 0;
      if (inc !== null && exp !== null) signed = Math.abs(inc ?? 0) - Math.abs(exp ?? 0);
    }
    if (signed === null) {
      errors.push(`Riga ${lineNo}: importo non valido.`);
      continue;
    }
    if (signed === 0) continue; // righe di saldo o vuote

    const kind: Kind = signed > 0 ? "entrata" : "uscita";
    const category = get(col.category).slice(0, 60) || (kind === "entrata" ? "Fatture" : "Altro");
    rows.push({
      date,
      kind,
      amount: round2(Math.abs(signed)),
      category,
      description: get(col.description).replace(/\s+/g, " ").slice(0, 300),
    });
  }
  if (rows.length === 0 && errors.length === 0) errors.push("Nessun movimento trovato.");
  return { rows, errors, separator };
}

// ─── Formattazione ─────────────────────────────────────────────

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
export const formatEur = (n: number) => eur.format(n);

export function formatPct(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
}

/** Chiave per riconoscere un movimento già presente (import ripetuti). */
export function dedupeKey(t: Pick<Transaction, "date" | "kind" | "amount" | "description">): string {
  return `${t.date}|${t.kind}|${round2(t.amount).toFixed(2)}|${t.description.trim().toLowerCase()}`;
}
