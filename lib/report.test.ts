import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, summarize, type Transaction } from "./finance";
import { buildReportPrompt, REPORT_SYSTEM_PROMPT } from "./report";

const txs: Transaction[] = [
  { id: "1", date: "2026-10-03", kind: "entrata", amount: 2000, category: "Fatture", description: "Fattura 9" },
  { id: "2", date: "2026-11-04", kind: "entrata", amount: 3000, category: "Fatture", description: "Fattura 10 Rossi" },
  { id: "3", date: "2026-11-06", kind: "uscita", amount: 120, category: "Software e abbonamenti", description: "Figma" },
];

describe("prompt del report", () => {
  const summary = summarize(txs, "mese", "2026-11-15", DEFAULT_SETTINGS);
  const prompt = buildReportPrompt(summary, txs, DEFAULT_SETTINGS);

  it("contiene periodo, totali e variazioni", () => {
    expect(prompt).toContain("Report mensile — novembre 2026");
    expect(prompt).toMatch(/Entrate: 3000,00\s€ \(vs periodo precedente: \+50%\)/);
    expect(prompt).toMatch(/Software e abbonamenti: 120,00\s€/);
  });

  it("contiene la stima fiscale del periodo e da inizio anno", () => {
    expect(prompt).toContain("Stima fiscale del periodo");
    expect(prompt).toMatch(/Incassi 5000,00\s€/);
  });

  it("include i movimenti del periodo ma non quelli fuori periodo", () => {
    expect(prompt).toContain("Fattura 10 Rossi");
    expect(prompt).not.toContain("Fattura 9");
  });

  it("il system prompt vieta di inventare numeri e chiarisce il forfettario", () => {
    expect(REPORT_SYSTEM_PROMPT).toMatch(/Non inventare/);
    expect(REPORT_SYSTEM_PROMPT).toMatch(/costi NON riducono le tasse/);
  });
});
