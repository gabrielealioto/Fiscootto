// Pianificazione: ambiti Work/Life, categorie, regole automatiche, spese ricorrenti,
// budget, obiettivi di risparmio e avvisi. Logica pura, testata in planning.test.ts.

import { addDays, CATEGORIES, periodRange, round2, type Kind, type Transaction } from "./finance";

// ─── Ambito Work / Life ─────────────────────────────────────────

export type Scope = "work" | "life";
export type View = Scope | "tutto";
export const SCOPES: Scope[] = ["work", "life"];
export const VIEWS: View[] = ["work", "life", "tutto"];

export const SCOPE_LABEL: Record<Scope, string> = { work: "Work", life: "Life" };
export const SCOPE_HINT: Record<Scope, string> = { work: "attività", life: "personale" };
export const VIEW_LABEL: Record<View, string> = { work: "Work", life: "Life", tutto: "Tutto" };

export const LIFE_CATEGORIES: Record<Kind, string[]> = {
  entrata: ["Stipendio e prelievi", "Regali", "Rimborsi", "Altro"],
  uscita: [
    "Casa e affitto",
    "Bollette",
    "Spesa alimentare",
    "Ristoranti e bar",
    "Svago",
    "Salute",
    "Trasporti personali",
    "Abbigliamento",
    "Abbonamenti personali",
    "Altro",
  ],
};

export interface CustomCategory {
  id: string;
  scope: Scope;
  kind: Kind;
  name: string;
  deducibile: number;
}

export const scopeOf = (t: Pick<Transaction, "scope">): Scope => (t.scope === "life" ? "life" : "work");
export const inView = (t: Pick<Transaction, "scope">, view: View) => view === "tutto" || scopeOf(t) === view;

/** Categorie disponibili: quelle predefinite dell'ambito più quelle personalizzate. */
export function categoriesFor(scope: Scope, kind: Kind, custom: CustomCategory[] = []): string[] {
  const base = scope === "work" ? CATEGORIES[kind] : LIFE_CATEGORIES[kind];
  const extra = custom.filter((c) => c.scope === scope && c.kind === kind && !base.includes(c.name)).map((c) => c.name);
  // "Altro" resta in fondo.
  const withoutAltro = [...base.filter((c) => c !== "Altro"), ...extra];
  return base.includes("Altro") ? [...withoutAltro, "Altro"] : withoutAltro;
}

// ─── Regole di categorizzazione ─────────────────────────────────

export interface CategoryRule {
  id: string;
  pattern: string;
  scope: Scope;
  kind: Kind;
  category: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/**
 * Trova la regola che si applica a una descrizione: confronto senza maiuscole e accenti,
 * vince il testo più lungo (più specifico). Restituisce ambito e categoria.
 */
export function matchRule(description: string, kind: Kind, rules: CategoryRule[]): CategoryRule | null {
  const d = normalize(description);
  if (!d) return null;
  let best: CategoryRule | null = null;
  for (const r of rules) {
    if (r.kind !== kind) continue;
    const p = normalize(r.pattern);
    if (p.length >= 2 && d.includes(p) && (!best || p.length > normalize(best.pattern).length)) best = r;
  }
  return best;
}

// ─── Spese ricorrenti ───────────────────────────────────────────

export type Frequency = "settimanale" | "mensile" | "bimestrale" | "trimestrale" | "semestrale" | "annuale";
export const FREQUENCIES: Frequency[] = ["settimanale", "mensile", "bimestrale", "trimestrale", "semestrale", "annuale"];
const MONTHS: Record<Exclude<Frequency, "settimanale">, number> = { mensile: 1, bimestrale: 2, trimestrale: 3, semestrale: 6, annuale: 12 };

export interface Recurring {
  id: string;
  name: string;
  scope: Scope;
  kind: Kind;
  amount: number;
  category: string;
  iva: number;
  frequency: Frequency;
  next_date: string;
  active: boolean;
}

/** Data della scadenza successiva. A fine mese si resta sull'ultimo giorno disponibile (31 gen → 28 feb). */
export function nextOccurrence(date: string, frequency: Frequency, anchorDay?: number): string {
  if (frequency === "settimanale") return addDays(date, 7);
  const [y, m, d] = date.split("-").map(Number);
  const months = MONTHS[frequency];
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const day = Math.min(anchorDay ?? d, last);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Costo equivalente mensile (per confrontare abbonamenti con frequenze diverse). */
export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  if (frequency === "settimanale") return round2((amount * 52) / 12);
  return round2(amount / MONTHS[frequency]);
}

export type DueStatus = "scaduta" | "oggi" | "presto" | "futura";

export function dueStatus(nextDate: string, today: string, soonDays = 7): DueStatus {
  if (nextDate < today) return "scaduta";
  if (nextDate === today) return "oggi";
  return nextDate <= addDays(today, soonDays) ? "presto" : "futura";
}

// ─── Budget ────────────────────────────────────────────────────

export interface Budget {
  id: string;
  scope: Scope;
  category: string;
  monthly_limit: number;
}

export type BudgetLevel = "ok" | "attenzione" | "superato";

export interface BudgetStatus extends Budget {
  spent: number;
  remaining: number;
  ratio: number; // speso / limite
  level: BudgetLevel;
}

export const BUDGET_WARNING = 0.8;

/** Spesa del mese di `ref` per ogni budget, con il livello di allerta. */
export function budgetStatuses(budgets: Budget[], txs: Transaction[], ref: string): BudgetStatus[] {
  const month = periodRange("mese", ref);
  return budgets
    .map((b) => {
      const spent = round2(
        txs
          .filter((t) => t.kind === "uscita" && scopeOf(t) === b.scope && t.category === b.category && t.date >= month.start && t.date <= month.end)
          .reduce((s, t) => s + t.amount, 0),
      );
      const ratio = spent / b.monthly_limit;
      const level: BudgetLevel = ratio > 1 ? "superato" : ratio >= BUDGET_WARNING ? "attenzione" : "ok";
      return { ...b, spent, remaining: round2(b.monthly_limit - spent), ratio, level };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

// ─── Obiettivi di risparmio ─────────────────────────────────────

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string | null;
}

export interface GoalStatus extends Goal {
  progress: number; // 0..1
  missing: number;
  monthsLeft: number | null;
  perMonth: number | null; // quanto mettere da parte al mese per arrivarci
  late: boolean; // scadenza passata senza averlo raggiunto
}

export function goalStatus(g: Goal, today: string): GoalStatus {
  const missing = round2(Math.max(0, g.target - g.saved));
  const progress = Math.min(1, g.saved / g.target);
  if (!g.deadline) return { ...g, progress, missing, monthsLeft: null, perMonth: null, late: false };
  const [ty, tm, td] = today.split("-").map(Number);
  const [dy, dm, dd] = g.deadline.split("-").map(Number);
  const months = (dy - ty) * 12 + (dm - tm) + (dd >= td ? 0 : -1);
  const monthsLeft = Math.max(0, months);
  const late = missing > 0 && g.deadline < today;
  const perMonth = missing === 0 ? 0 : round2(missing / Math.max(1, monthsLeft));
  return { ...g, progress, missing, monthsLeft, perMonth, late };
}

// ─── Avvisi ────────────────────────────────────────────────────

export type AlertLevel = "critico" | "attenzione" | "info";

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  href: string;
}

const eur = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const dateIt = (iso: string) => iso.split("-").reverse().join("/");

/** Avvisi in-app su budget, scadenze e obiettivi, dal più urgente. */
export function buildAlerts(budgets: BudgetStatus[], recurring: Recurring[], goals: GoalStatus[], today: string): Alert[] {
  const out: Alert[] = [];
  for (const b of budgets) {
    if (b.level === "superato") {
      out.push({
        id: `budget-${b.id}`,
        level: "critico",
        title: `Budget superato: ${b.category}`,
        detail: `${eur(b.spent)} spesi su ${eur(b.monthly_limit)} (${SCOPE_LABEL[b.scope]}), ${eur(-b.remaining)} oltre il tetto.`,
        href: "/pianifica#budget",
      });
    } else if (b.level === "attenzione") {
      out.push({
        id: `budget-${b.id}`,
        level: "attenzione",
        title: `Budget quasi esaurito: ${b.category}`,
        detail: `Restano ${eur(b.remaining)} su ${eur(b.monthly_limit)} questo mese (${SCOPE_LABEL[b.scope]}).`,
        href: "/pianifica#budget",
      });
    }
  }
  for (const r of recurring) {
    if (!r.active) continue;
    const s = dueStatus(r.next_date, today);
    if (s === "futura") continue;
    out.push({
      id: `rec-${r.id}`,
      level: s === "scaduta" ? "critico" : "attenzione",
      title: s === "scaduta" ? `Scadenza passata: ${r.name}` : s === "oggi" ? `Scade oggi: ${r.name}` : `In scadenza: ${r.name}`,
      detail: `${eur(r.amount)} ${s === "scaduta" ? "dal" : "il"} ${dateIt(r.next_date)}. Registralo quando l'hai pagato.`,
      href: "/pianifica#ricorrenti",
    });
  }
  for (const g of goals) {
    if (g.late) {
      out.push({
        id: `goal-${g.id}`,
        level: "attenzione",
        title: `Obiettivo scaduto: ${g.name}`,
        detail: `Mancano ${eur(g.missing)}: sposta la data o aggiorna il traguardo.`,
        href: "/pianifica#obiettivi",
      });
    }
  }
  const rank: Record<AlertLevel, number> = { critico: 0, attenzione: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
