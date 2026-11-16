import { describe, expect, it } from "vitest";
import { atecoDigits, formatAteco, lookupAteco } from "./ateco";

const coeff = (code: string) => {
  const r = lookupAteco(code);
  return r.status === "ok" ? r.group.coefficiente : r.status;
};

describe("codice ATECO", () => {
  it("normalizza e formatta", () => {
    expect(atecoDigits("62.01.00")).toBe("620100");
    expect(formatAteco("620100")).toBe("62.01.00");
    expect(formatAteco("62 01")).toBe("62.01");
    expect(formatAteco("74")).toBe("74");
  });

  it.each([
    ["62.01.00", 0.67], // produzione di software: altre attività
    ["74.10.21", 0.78], // grafica: attività professionali
    ["69.20.11", 0.78], // commercialisti
    ["86.90.21", 0.78], // sanitarie
    ["85.59.20", 0.78], // istruzione
    ["43.21.01", 0.86], // costruzioni
    ["68.31.00", 0.86], // immobiliari
    ["56.10.11", 0.4], // ristorazione
    ["10.71.10", 0.4], // alimentari
    ["46.18.99", 0.62], // intermediari del commercio
    ["46.90.00", 0.4], // commercio all'ingrosso
    ["47.91.10", 0.4], // commercio al dettaglio online
    ["45.20.10", 0.4], // commercio e riparazione veicoli
    ["96.02.01", 0.67], // parrucchieri
    ["73.11.02", 0.78], // marketing e pubblicità
  ])("%s → %s", (code, expected) => {
    expect(coeff(code)).toBe(expected);
  });

  it("nel commercio segnala che i codici ATECO 2025 vanno verificati", () => {
    const r = lookupAteco("47.91.10");
    expect(r.status === "ok" && r.note).toMatch(/ATECO 2025/);
    expect(lookupAteco("62.01.00").status === "ok" && (lookupAteco("62.01.00") as { note?: string }).note).toBeFalsy();
  });

  it("per il commercio ambulante chiede di scegliere", () => {
    const r = lookupAteco("47.82.01");
    expect(r.status).toBe("choose");
    if (r.status === "choose") expect(r.options.map((o) => o.coefficiente)).toEqual([0.54, 0.4]);
    expect(lookupAteco("46").status).toBe("choose");
  });

  it("rifiuta codici non validi", () => {
    expect(lookupAteco("").status).toBe("invalid");
    expect(lookupAteco("6").status).toBe("invalid");
    expect(lookupAteco("1234567").status).toBe("invalid");
    expect(lookupAteco("00.00").status).toBe("invalid");
  });
});
