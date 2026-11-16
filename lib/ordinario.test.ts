import { describe, expect, it } from "vitest";
import { summarize, type TaxSettings, type Transaction } from "./finance";
import { costRule, EMPTY_TOTALS, estimateOrdinario, irpef, ordinarioTotals, splitIva } from "./ordinario";

const s = {
  gestione: "separata" as const,
  aliquota_contributi: 0.2607,
  addizionale_regionale: 0.0123,
  addizionale_comunale: 0.008,
};

describe("IVA", () => {
  it("scorpora l'IVA da un importo lordo", () => {
    const r = splitIva(1_220, 22);
    expect(r.netto).toBeCloseTo(1_000, 6);
    expect(r.iva).toBeCloseTo(220, 6);
    expect(splitIva(100, 0)).toEqual({ netto: 100, iva: 0 });
  });
});

describe("deducibilità delle spese", () => {
  it("materiali, merci e costi auto/telefono secondo i limiti", () => {
    const t = ordinarioTotals([
      { kind: "uscita", amount: 1_220, iva: 22, category: "Materiali e prodotti di consumo" },
      { kind: "uscita", amount: 2_440, iva: 22, category: "Merci per la rivendita" },
      { kind: "uscita", amount: 122, iva: 22, category: "Telefono e internet" },
      { kind: "uscita", amount: 122, iva: 22, category: "Auto e carburante" },
    ]);
    // Materiali 1.000 + merci 2.000 (IVA detraibile al 100%)
    // Telefono: IVA detraibile 50% → costo 100 + 11 = 111, deducibile 80% = 88,8
    // Auto: IVA detraibile 40% → costo 100 + 13,2 = 113,2, deducibile 20% = 22,64
    expect(t.costiDeducibili).toBeCloseTo(3_000 + 88.8 + 22.64, 6);
    expect(t.ivaAcquistiDetraibile).toBeCloseTo(220 + 440 + 11 + 8.8, 6);
  });

  it("hardware: sotto 516,46 € tutto, sopra il 20% di ammortamento", () => {
    expect(ordinarioTotals([{ kind: "uscita", amount: 610, iva: 22, category: "Hardware" }]).costiDeducibili).toBeCloseTo(500, 6);
    expect(ordinarioTotals([{ kind: "uscita", amount: 1_220, iva: 22, category: "Hardware" }]).costiDeducibili).toBeCloseTo(200, 6);
  });

  it("tasse e categorie generiche non vengono dedotte", () => {
    expect(costRule("Tasse e contributi").deducibile).toBe(0);
    expect(costRule("Altro").deducibile).toBe(0);
    expect(costRule("Una mia categoria").deducibile).toBe(0);
    expect(costRule("Merci per la rivendita").deducibile).toBe(1);
  });
});

describe("IRPEF 2026", () => {
  it.each([
    [0, 0],
    [20_000, 4_600],
    [28_000, 6_440],
    [40_000, 6_440 + 12_000 * 0.33],
    [60_000, 6_440 + 22_000 * 0.33 + 10_000 * 0.43],
  ])("IRPEF su %s € = %s €", (imponibile, atteso) => {
    expect(irpef(imponibile)).toBeCloseTo(atteso, 6);
  });

  it("oltre 200.000 € recupera i 440 € del taglio al 33%", () => {
    expect(irpef(200_001) - irpef(200_000)).toBeCloseTo(0.43 + 440, 6);
  });
});

describe("stima regime ordinario", () => {
  it("un anno intero: reddito, contributi, IRPEF, addizionali e IVA", () => {
    const anno = ordinarioTotals([
      { kind: "entrata", amount: 61_000, iva: 22, category: "Fatture" }, // ricavi 50.000
      { kind: "uscita", amount: 12_200, iva: 22, category: "Merci per la rivendita" }, // costi 10.000
    ]);
    const e = estimateOrdinario(EMPTY_TOTALS, anno, 0, 1, s);
    expect(e.reddito).toBe(40_000);
    expect(e.contributi).toBeCloseTo(40_000 * 0.2607, 1);
    const base = 40_000 - 40_000 * 0.2607;
    expect(e.imponibileIrpef).toBeCloseTo(base, 1);
    expect(e.irpef).toBeCloseTo(irpef(base), 1);
    expect(e.addizionali).toBeCloseTo(base * 0.0203, 1);
    expect(e.iva).toBeCloseTo(11_000 - 2_200, 1);
  });

  it("le spese per prodotti riducono le tasse", () => {
    const senza = ordinarioTotals([{ kind: "entrata", amount: 36_600, iva: 22, category: "Fatture" }]);
    const con = ordinarioTotals([
      { kind: "entrata", amount: 36_600, iva: 22, category: "Fatture" },
      { kind: "uscita", amount: 6_100, iva: 22, category: "Materiali e prodotti di consumo" },
    ]);
    const a = estimateOrdinario(EMPTY_TOTALS, senza, 0, 1, s);
    const b = estimateOrdinario(EMPTY_TOTALS, con, 0, 1, s);
    expect(b.irpef).toBeLessThan(a.irpef);
    expect(b.contributi).toBeLessThan(a.contributi);
    expect(b.iva).toBeCloseTo(a.iva - 1_100, 1);
  });

  it("la somma dei mesi coincide con la stima dell'anno", () => {
    const mese = ordinarioTotals([
      { kind: "entrata", amount: 6_100, iva: 22, category: "Fatture" },
      { kind: "uscita", amount: 1_220, iva: 22, category: "Materiali e prodotti di consumo" },
    ]);
    let prima = EMPTY_TOTALS;
    let tot = 0;
    for (let m = 0; m < 12; m++) {
      const e = estimateOrdinario(prima, mese, m / 12, 1 / 12, s);
      tot += e.irpef + e.addizionali + e.contributi;
      prima = {
        ricavi: prima.ricavi + mese.ricavi,
        costiDeducibili: prima.costiDeducibili + mese.costiDeducibili,
        ivaVendite: prima.ivaVendite + mese.ivaVendite,
        ivaAcquistiDetraibile: prima.ivaAcquistiDetraibile + mese.ivaAcquistiDetraibile,
      };
    }
    const anno = estimateOrdinario(EMPTY_TOTALS, prima, 0, 1, s);
    expect(tot).toBeCloseTo(anno.irpef + anno.addizionali + anno.contributi, 0);
  });

  it("il riepilogo della dashboard usa il regime scelto", () => {
    const tx = (date: string, kind: "entrata" | "uscita", amount: number, category: string, iva = 22): Transaction => ({
      id: `${date}${category}`,
      date,
      kind,
      amount,
      category,
      description: "",
      iva,
    });
    const txs = [tx("2026-11-03", "entrata", 6_100, "Fatture"), tx("2026-11-10", "uscita", 1_220, "Merci per la rivendita")];
    const settings: TaxSettings = { coefficiente: 0.78, aliquota_imposta: 0.15, ...s, regime: "ordinario" };
    const r = summarize(txs, "mese", "2026-11-15", settings);
    expect(r.tax.regime).toBe("ordinario");
    expect(r.tax.ricavi).toBe(5_000);
    expect(r.tax.costiDeducibili).toBe(1_000);
    expect(r.tax.iva).toBe(880);
    expect(r.tax.totale).toBeCloseTo(r.tax.contributi + r.tax.irpef + r.tax.addizionali + 880, 1);
    const f = summarize(txs, "mese", "2026-11-15", { ...settings, regime: "forfettario" });
    expect(f.tax.regime).toBe("forfettario");
    expect(f.tax.iva).toBe(0);
  });
});
