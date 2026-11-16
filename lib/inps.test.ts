import { describe, expect, it } from "vitest";
import { estimateTax, estimateTaxRange, summarize, type TaxSettings, type Transaction } from "./finance";
import { fixedContributionsYear, GESTIONE_INFO, variableContributions } from "./inps";

const base = { coefficiente: 0.78, aliquota_imposta: 0.15 };
const separata: TaxSettings = { ...base, gestione: "separata", aliquota_contributi: 0.2607 };
const artigiani: TaxSettings = { ...base, gestione: "artigiani", aliquota_contributi: 0.24 };
const commercianti: TaxSettings = { ...base, gestione: "commercianti", aliquota_contributi: 0.2448 };

describe("gestioni INPS 2026", () => {
  it("valori delle circolari 2026", () => {
    expect(GESTIONE_INFO.separata.aliquota).toBe(0.2607);
    expect(GESTIONE_INFO.separata_ridotta.aliquota).toBe(0.24);
    expect(GESTIONE_INFO.separata.massimale).toBe(122_295);
    expect(GESTIONE_INFO.artigiani.minimale).toBe(18_808);
    expect(GESTIONE_INFO.artigiani.fissi).toBe(4_521.36);
    expect(GESTIONE_INFO.commercianti.fissi).toBe(4_611.64);
    expect(GESTIONE_INFO.commercianti.aliquota).toBe(0.2448);
  });

  it("Gestione Separata: percentuale fino al massimale", () => {
    expect(variableContributions(10_000, separata)).toBeCloseTo(2_607, 2);
    expect(variableContributions(200_000, separata)).toBeCloseTo(122_295 * 0.2607, 2);
  });

  it("artigiani: niente sotto il minimale, 24% sull'eccedenza, 25% oltre la soglia", () => {
    expect(variableContributions(15_000, artigiani)).toBe(0);
    expect(variableContributions(28_808, artigiani)).toBeCloseTo(2_400, 2);
    // 56.224 − 18.808 = 37.416 al 24%, poi 10.000 al 25%
    expect(variableContributions(66_224, artigiani)).toBeCloseTo(37_416 * 0.24 + 10_000 * 0.25, 2);
    expect(fixedContributionsYear(artigiani)).toBe(4_521.36);
  });

  it("commercianti: 24,48% e 25,48% oltre la soglia", () => {
    expect(variableContributions(66_224, commercianti)).toBeCloseTo(37_416 * 0.2448 + 10_000 * 0.2548, 2);
    expect(fixedContributionsYear(commercianti)).toBe(4_611.64);
  });

  it("riduzione del 35% solo per artigiani e commercianti", () => {
    expect(fixedContributionsYear({ ...artigiani, riduzione_35: true })).toBeCloseTo(4_521.36 * 0.65, 2);
    expect(variableContributions(28_808, { ...artigiani, riduzione_35: true })).toBeCloseTo(2_400 * 0.65, 2);
    expect(variableContributions(10_000, { ...separata, riduzione_35: true })).toBeCloseTo(2_607, 2);
  });

  it("cassa professionale: aliquota scelta, senza massimale", () => {
    expect(variableContributions(200_000, { ...base, gestione: "cassa", aliquota_contributi: 0.145 })).toBeCloseTo(29_000, 2);
  });
});

describe("stima per periodo", () => {
  it("artigiano con 30.000 € di incassi in un anno", () => {
    const t = estimateTax(30_000, artigiani);
    // imponibile 23.400: fissi 4.521,36 + 24% di (23.400 − 18.808)
    expect(t.contributiFissi).toBe(4_521.36);
    expect(t.contributi).toBeCloseTo(4_521.36 + (23_400 - 18_808) * 0.24, 2);
    expect(t.imposta).toBeCloseTo((23_400 - t.contributi) * 0.15, 1);
  });

  it("i contributi fissi si ripartiscono anche nei mesi senza incassi", () => {
    const t = estimateTaxRange(0, 0, 30 / 365, artigiani);
    expect(t.contributi).toBeCloseTo((4_521.36 * 30) / 365, 1);
    expect(t.imposta).toBe(0);
  });

  it("la somma dei mesi dà la stima dell'anno", () => {
    const monthly = 4_000; // 12 mesi × 4.000 = 48.000 € di incassi
    let prima = 0;
    let sum = 0;
    for (let m = 0; m < 12; m++) {
      sum += estimateTaxRange(prima, monthly, 1 / 12, artigiani).contributi;
      prima += monthly;
    }
    expect(sum).toBeCloseTo(estimateTax(48_000, artigiani).contributi, 0);
  });

  it("Gestione Separata: superato il massimale i contributi del periodo si fermano", () => {
    const prima = 160_000; // imponibile prima del periodo: 124.800, già oltre il massimale
    expect(estimateTaxRange(prima, 10_000, 1 / 12, separata).contributi).toBe(0);
  });

  it("il riepilogo usa gli incassi precedenti dell'anno", () => {
    const tx = (date: string, amount: number): Transaction => ({ id: date, date, kind: "entrata", amount, category: "Fatture", description: "" });
    const txs = [tx("2026-01-10", 30_000), tx("2026-11-05", 10_000)]; // gennaio: imponibile 23.400, sopra il minimale
    const s = summarize(txs, "mese", "2026-11-15", artigiani);
    // A novembre il minimale è già superato: tutto l'imponibile del mese paga il 24%.
    expect(s.tax.contributi).toBeCloseTo(7_800 * 0.24 + (4_521.36 * 30) / 365, 1);
    expect(s.taxYtd.contributiFissi).toBeCloseTo((4_521.36 * 334) / 365, 1);
  });
});
