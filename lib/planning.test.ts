import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, summarize, type Transaction } from "./finance";
import {
  budgetStatuses,
  buildAlerts,
  categoriesFor,
  dueStatus,
  goalStatus,
  matchRule,
  monthlyEquivalent,
  nextOccurrence,
  type CategoryRule,
  type Recurring,
} from "./planning";

const tx = (date: string, kind: "entrata" | "uscita", amount: number, category: string, scope: "work" | "life" = "work"): Transaction => ({
  id: `${date}-${category}-${amount}`,
  date,
  kind,
  amount,
  category,
  description: "",
  scope,
});

describe("categorie per ambito", () => {
  it("Work e Life hanno categorie diverse, con le personalizzate prima di Altro", () => {
    expect(categoriesFor("work", "uscita")).toContain("Merci per la rivendita");
    expect(categoriesFor("life", "uscita")).toContain("Spesa alimentare");
    expect(categoriesFor("life", "uscita")).not.toContain("Merci per la rivendita");
    const withCustom = categoriesFor("life", "uscita", [{ id: "1", scope: "life", kind: "uscita", name: "Palestra", deducibile: 0 }]);
    expect(withCustom.slice(-2)).toEqual(["Palestra", "Altro"]);
    expect(categoriesFor("work", "uscita", [{ id: "1", scope: "life", kind: "uscita", name: "Palestra", deducibile: 0 }])).not.toContain("Palestra");
  });
});

describe("regole automatiche", () => {
  const rules: CategoryRule[] = [
    { id: "1", pattern: "enel", scope: "life", kind: "uscita", category: "Bollette" },
    { id: "2", pattern: "amazon", scope: "work", kind: "uscita", category: "Materiali e prodotti di consumo" },
    { id: "3", pattern: "amazon prime", scope: "life", kind: "uscita", category: "Abbonamenti personali" },
    { id: "4", pattern: "rossi", scope: "work", kind: "entrata", category: "Fatture" },
  ];
  it("trova la regola senza maiuscole né accenti", () => {
    expect(matchRule("Addebito SDD ENEL ENERGIA", "uscita", rules)?.category).toBe("Bollette");
    expect(matchRule("Pagamento àmazon EU", "uscita", rules)?.category).toBe("Materiali e prodotti di consumo");
  });
  it("vince la regola più specifica e conta il tipo di movimento", () => {
    expect(matchRule("AMAZON PRIME rinnovo", "uscita", rules)?.scope).toBe("life");
    expect(matchRule("Bonifico da Rossi Srl", "uscita", rules)).toBeNull();
    expect(matchRule("Bonifico da Rossi Srl", "entrata", rules)?.category).toBe("Fatture");
    expect(matchRule("", "uscita", rules)).toBeNull();
  });
});

describe("spese ricorrenti", () => {
  it("calcola la scadenza successiva", () => {
    expect(nextOccurrence("2026-11-16", "settimanale")).toBe("2026-11-23");
    expect(nextOccurrence("2026-11-16", "mensile")).toBe("2026-12-16");
    expect(nextOccurrence("2026-12-16", "mensile")).toBe("2027-01-16");
    expect(nextOccurrence("2026-01-31", "mensile")).toBe("2026-02-28");
    expect(nextOccurrence("2026-02-28", "mensile", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2026-11-30", "trimestrale")).toBe("2027-02-28");
    expect(nextOccurrence("2026-05-10", "annuale")).toBe("2027-05-10");
  });
  it("equivalente mensile", () => {
    expect(monthlyEquivalent(120, "annuale")).toBe(10);
    expect(monthlyEquivalent(30, "trimestrale")).toBe(10);
    expect(monthlyEquivalent(10, "settimanale")).toBe(43.33);
  });
  it("stato della scadenza", () => {
    expect(dueStatus("2026-11-10", "2026-11-16")).toBe("scaduta");
    expect(dueStatus("2026-11-16", "2026-11-16")).toBe("oggi");
    expect(dueStatus("2026-11-20", "2026-11-16")).toBe("presto");
    expect(dueStatus("2026-12-20", "2026-11-16")).toBe("futura");
  });
});

describe("budget", () => {
  const txs = [
    tx("2026-11-02", "uscita", 300, "Spesa alimentare", "life"),
    tx("2026-11-09", "uscita", 150, "Spesa alimentare", "life"),
    tx("2026-10-20", "uscita", 999, "Spesa alimentare", "life"), // mese precedente
    tx("2026-11-05", "uscita", 85, "Svago", "life"),
    tx("2026-11-05", "uscita", 500, "Svago", "work"), // altro ambito
  ];
  it("speso del mese per categoria e ambito, con livelli", () => {
    const s = budgetStatuses(
      [
        { id: "a", scope: "life", category: "Spesa alimentare", monthly_limit: 400 },
        { id: "b", scope: "life", category: "Svago", monthly_limit: 100 },
        { id: "c", scope: "life", category: "Salute", monthly_limit: 50 },
      ],
      txs,
      "2026-11-16",
    );
    expect(s.map((b) => [b.category, b.spent, b.level])).toEqual([
      ["Spesa alimentare", 450, "superato"],
      ["Svago", 85, "attenzione"],
      ["Salute", 0, "ok"],
    ]);
  });
});

describe("obiettivi", () => {
  it("progresso e quota mensile per arrivare alla scadenza", () => {
    const g = goalStatus({ id: "1", name: "Fondo emergenza", target: 6000, saved: 1500, deadline: "2027-05-16" }, "2026-11-16");
    expect(g.progress).toBe(0.25);
    expect(g.missing).toBe(4500);
    expect(g.monthsLeft).toBe(6);
    expect(g.perMonth).toBe(750);
    expect(g.late).toBe(false);
  });
  it("obiettivo senza scadenza o già raggiunto", () => {
    expect(goalStatus({ id: "1", name: "Bici", target: 800, saved: 100, deadline: null }, "2026-11-16").perMonth).toBeNull();
    expect(goalStatus({ id: "1", name: "Bici", target: 800, saved: 900, deadline: "2026-01-01" }, "2026-11-16").late).toBe(false);
    expect(goalStatus({ id: "1", name: "Bici", target: 800, saved: 100, deadline: "2026-10-01" }, "2026-11-16").late).toBe(true);
  });
});

describe("avvisi", () => {
  it("ordina dal più urgente", () => {
    const rec: Recurring = { id: "r", name: "Affitto", scope: "life", kind: "uscita", amount: 700, category: "Casa e affitto", iva: 0, frequency: "mensile", next_date: "2026-11-01", active: true };
    const alerts = buildAlerts(
      budgetStatuses([{ id: "b", scope: "life", category: "Svago", monthly_limit: 100 }], [tx("2026-11-05", "uscita", 85, "Svago", "life")], "2026-11-16"),
      [rec, { ...rec, id: "s", name: "Netflix", next_date: "2026-11-18" }, { ...rec, id: "x", name: "Spenta", active: false }],
      [],
      "2026-11-16",
    );
    expect(alerts.map((a) => [a.level, a.title])).toEqual([
      ["critico", "Scadenza passata: Affitto"],
      ["attenzione", "Budget quasi esaurito: Svago"],
      ["attenzione", "In scadenza: Netflix"],
    ]);
  });
});

describe("Work e Life nel riepilogo", () => {
  const txs = [
    tx("2026-11-03", "entrata", 5000, "Fatture"),
    tx("2026-11-04", "uscita", 400, "Software e abbonamenti"),
    tx("2026-11-05", "uscita", 700, "Casa e affitto", "life"),
    tx("2026-11-06", "entrata", 1500, "Stipendio e prelievi", "life"),
  ];
  it("la vista sceglie i movimenti, le tasse usano solo il lavoro", () => {
    const work = summarize(txs, "mese", "2026-11-16", DEFAULT_SETTINGS, 6, "work");
    const life = summarize(txs, "mese", "2026-11-16", DEFAULT_SETTINGS, 6, "life");
    const all = summarize(txs, "mese", "2026-11-16", DEFAULT_SETTINGS, 6, "tutto");
    expect(work.current).toMatchObject({ entrate: 5000, uscite: 400 });
    expect(life.current).toMatchObject({ entrate: 1500, uscite: 700 });
    expect(all.current).toMatchObject({ entrate: 6500, uscite: 1100 });
    expect(life.tax.totale).toBe(work.tax.totale);
    expect(all.tax.totale).toBe(work.tax.totale);
    expect(work.tax.ricavi).toBe(5000);
  });
});
