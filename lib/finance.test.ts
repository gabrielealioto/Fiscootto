import { describe, expect, it } from "vitest";
import {
  addDays,
  byCategory,
  dataRange,
  dedupeKey,
  estimateTax,
  isIsoDate,
  lastPeriods,
  longLabel,
  parseAmount,
  parseCsv,
  parseDate,
  pctChange,
  periodRange,
  shiftPeriod,
  splitCsvLine,
  summarize,
  todayRome,
  totals,
  type Transaction,
} from "./finance";

const tx = (date: string, kind: "entrata" | "uscita", amount: number, category = "Altro", description = ""): Transaction => ({
  id: `${date}-${kind}-${amount}-${category}`,
  date,
  kind,
  amount,
  category,
  description,
});

describe("date e periodi", () => {
  it("valida le date ISO", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-2-1")).toBe(false);
  });

  it("somma giorni attraversando mesi e anni", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("settimana da lunedì a domenica", () => {
    // 15/11/2026 è domenica
    expect(periodRange("settimana", "2026-11-15")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(periodRange("settimana", "2026-11-09")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(periodRange("settimana", "2026-01-01")).toEqual({ start: "2025-12-29", end: "2026-01-04" });
  });

  it("mese con l'ultimo giorno corretto", () => {
    expect(periodRange("mese", "2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodRange("mese", "2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(periodRange("giorno", "2026-05-05")).toEqual({ start: "2026-05-05", end: "2026-05-05" });
  });

  it("sposta i periodi senza perdere giorni a fine mese", () => {
    expect(shiftPeriod("mese", "2026-03-31", -1)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(shiftPeriod("mese", "2026-01-15", -1)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(shiftPeriod("settimana", "2026-11-15", -1).start).toBe("2026-11-02");
    expect(shiftPeriod("giorno", "2026-03-01", -1).start).toBe("2026-02-28");
  });

  it("ultimi 6 periodi in ordine cronologico", () => {
    const months = lastPeriods("mese", "2026-02-15", 6).map((r) => r.start);
    expect(months).toEqual(["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
  });

  it("intervallo dati include l'inizio dell'anno", () => {
    expect(dataRange("mese", "2026-11-15")).toEqual({ start: "2026-01-01", end: "2026-11-30" });
    expect(dataRange("mese", "2026-02-15")).toEqual({ start: "2025-09-01", end: "2026-02-28" });
  });

  it("etichette in italiano", () => {
    expect(longLabel("mese", periodRange("mese", "2026-11-15"))).toBe("novembre 2026");
    expect(longLabel("settimana", periodRange("settimana", "2026-11-15"))).toBe("9 nov – 15 nov 2026");
  });

  it("oggi nel fuso di Roma", () => {
    // 23:30 UTC del 31/12 è già il primo gennaio in Italia
    expect(todayRome(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});

describe("aggregati", () => {
  const data = [
    tx("2026-10-05", "entrata", 1000, "Fatture"),
    tx("2026-10-20", "uscita", 200, "Software e abbonamenti"),
    tx("2026-11-02", "entrata", 1500.5, "Fatture"),
    tx("2026-11-03", "uscita", 100.25, "Software e abbonamenti"),
    tx("2026-11-10", "uscita", 300, "Hardware"),
    tx("2026-11-12", "uscita", 50, "Software e abbonamenti"),
  ];

  it("calcola entrate, uscite e utile nel periodo", () => {
    expect(totals(data, periodRange("mese", "2026-11-15"))).toEqual({
      entrate: 1500.5,
      uscite: 450.25,
      utile: 1050.25,
      movimenti: 4,
    });
  });

  it("raggruppa le uscite per categoria", () => {
    expect(byCategory(data, periodRange("mese", "2026-11-15"))).toEqual([
      { category: "Hardware", amount: 300 },
      { category: "Software e abbonamenti", amount: 150.25 },
    ]);
  });

  it("variazione percentuale", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(-50, -100)).toBe(50); // perdita dimezzata = miglioramento
  });

  it("riepilogo completo con confronto, storico e anno in corso", () => {
    const s = summarize(data, "mese", "2026-11-15", { coefficiente: 0.78, aliquota_contributi: 0.2607, aliquota_imposta: 0.15 });
    expect(s.previous.entrate).toBe(1000);
    expect(s.change.entrate).toBe(50.05);
    expect(s.history).toHaveLength(6);
    expect(s.history.at(-1)?.label).toBe("nov 26");
    expect(s.taxYtd.incassi).toBe(2500.5);
    expect(s.taxYtd.yearStart).toBe("2026-01-01");
  });
});

describe("stima fiscale forfettario", () => {
  it("applica coefficiente, contributi e imposta sostitutiva", () => {
    const t = estimateTax(10000, { coefficiente: 0.78, aliquota_contributi: 0.2607, aliquota_imposta: 0.15 });
    expect(t.imponibile).toBe(7800);
    expect(t.contributi).toBe(2033.46);
    expect(t.imposta).toBe(864.98); // (7800 − 2033,46) × 15%
    expect(t.totale).toBe(2898.44);
    expect(t.quotaSuIncassi).toBeCloseTo(0.2898, 4);
  });

  it("aliquota agevolata al 5%", () => {
    const t = estimateTax(10000, { coefficiente: 0.67, aliquota_contributi: 0.2607, aliquota_imposta: 0.05 });
    expect(t.imponibile).toBe(6700);
    expect(t.imposta).toBe(247.67);
  });

  it("zero incassi, zero tasse", () => {
    expect(estimateTax(0, { coefficiente: 0.78, aliquota_contributi: 0.2607, aliquota_imposta: 0.15 }).totale).toBe(0);
  });
});

describe("parser importi e date", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["-12,50", -12.5],
    ["€ 1.234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234", 1234],
    ["0.500", 0.5],
    ["12.5", 12.5],
    ["+300", 300],
    ["(45,00)", -45],
    ["45,00-", -45],
    ["1.234.567,8", 1234567.8],
    ["EUR 99", 99],
  ])("parseAmount(%s) = %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it("rifiuta importi non numerici", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });

  it.each([
    ["31/12/2025", "2025-12-31"],
    ["1/2/2026", "2026-02-01"],
    ["31-12-25", "2025-12-31"],
    ["31.12.2025", "2025-12-31"],
    ["2025-12-31", "2025-12-31"],
    ["2025-12-31T10:00:00", "2025-12-31"],
  ])("parseDate(%s) = %s", (raw, expected) => {
    expect(parseDate(raw)).toBe(expected);
  });

  it("rifiuta date impossibili", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("ieri")).toBeNull();
  });

  it("divide le righe rispettando le virgolette", () => {
    expect(splitCsvLine('a;"b;c";"d ""e"""', ";")).toEqual(["a", "b;c", 'd "e"']);
  });
});

describe("import CSV", () => {
  it("formato con importo firmato e separatore ;", () => {
    const csv = [
      "Data;Descrizione;Importo;Categoria",
      "01/11/2026;Fattura 12/2026 Rossi Srl;1.500,00;Fatture",
      '03/11/2026;"Abbonamento Figma; mensile";-15,00;Software e abbonamenti',
      "05/11/2026;Commissioni;-2,50;",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.separator).toBe(";");
    expect(r.rows).toEqual([
      { date: "2026-11-01", kind: "entrata", amount: 1500, category: "Fatture", description: "Fattura 12/2026 Rossi Srl" },
      { date: "2026-11-03", kind: "uscita", amount: 15, category: "Software e abbonamenti", description: "Abbonamento Figma; mensile" },
      { date: "2026-11-05", kind: "uscita", amount: 2.5, category: "Altro", description: "Commissioni" },
    ]);
  });

  it("formato con colonne entrate/uscite, separatore , e BOM", () => {
    const csv = '﻿data,descrizione,entrate,uscite\r\n2026-11-01,Cliente A,"1.000,00",\r\n2026-11-02,Treno,,"35,90"\r\n';
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.separator).toBe(",");
    expect(r.rows.map((x) => [x.kind, x.amount, x.category])).toEqual([
      ["entrata", 1000, "Fatture"],
      ["uscita", 35.9, "Altro"],
    ]);
  });

  it("salta le righe introduttive della banca e segnala gli errori", () => {
    const csv = [
      "Estratto conto;;",
      "Conto n. 123;;",
      "Data operazione;Causale;Importo",
      "01/11/2026;Bonifico;200,00",
      "xx/11/2026;Errata;10,00",
      "02/11/2026;Senza importo;abc",
      "03/11/2026;Saldo;0,00",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual(['Riga 5: data non valida ("xx/11/2026").', "Riga 6: importo non valido."]);
  });

  it("errore se mancano le colonne obbligatorie", () => {
    expect(parseCsv("nome;valore\nA;1").errors[0]).toMatch(/data/);
    expect(parseCsv("data;descrizione\n01/01/2026;x").errors[0]).toMatch(/importo/);
    expect(parseCsv("").errors).toEqual(["Il file è vuoto."]);
  });

  it("chiave per riconoscere i duplicati", () => {
    expect(dedupeKey({ date: "2026-11-01", kind: "uscita", amount: 15, description: " Figma " })).toBe(
      dedupeKey({ date: "2026-11-01", kind: "uscita", amount: 15.0, description: "figma" }),
    );
  });
});
