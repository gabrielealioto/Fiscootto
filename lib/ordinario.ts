// Regime ordinario / semplificato (persone fisiche): IVA, spese deducibili, IRPEF 2026.
// Stima prudenziale per l'accantonamento, non un calcolo dichiarativo: niente detrazioni
// personali, addizionali con aliquota unica, principio di cassa sulle spese.

import { fixedContributionsYear, variableContributions, type InpsSettings } from "./inps";

export type Regime = "forfettario" | "ordinario";

export const IVA_RATES = [22, 10, 5, 4, 0] as const;
export type IvaRate = (typeof IVA_RATES)[number];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Imponibile e IVA contenuti in un importo lordo (IVA inclusa). */
export function splitIva(lordo: number, aliquota: number): { netto: number; iva: number } {
  const netto = lordo / (1 + aliquota / 100);
  return { netto, iva: lordo - netto };
}

// ─── Deducibilità delle spese ───────────────────────────────────

export interface CostRule {
  /** Quota del costo deducibile dal reddito (0..1). */
  deducibile: number;
  /** Quota dell'IVA sugli acquisti che si può detrarre (0..1). */
  ivaDetraibile: number;
  /** Aliquota IVA proposta per i nuovi movimenti di questa categoria. */
  ivaPredefinita: IvaRate;
  nota?: string;
}

/** Soglia sotto cui un bene strumentale si deduce tutto nell'anno (art. 54 / 102 TUIR). */
export const SOGLIA_BENI_STRUMENTALI = 516.46;
/** Coefficiente di ammortamento annuo per macchine d'ufficio elettroniche (DM 31/12/1988). */
export const AMMORTAMENTO_HARDWARE = 0.2;

export const COST_RULES: Record<string, CostRule> = {
  "Materiali e prodotti di consumo": { deducibile: 1, ivaDetraibile: 1, ivaPredefinita: 22 },
  "Merci per la rivendita": {
    deducibile: 1,
    ivaDetraibile: 1,
    ivaPredefinita: 22,
    nota: "Dedotte quando le paghi (contabilità semplificata, principio di cassa).",
  },
  "Software e abbonamenti": { deducibile: 1, ivaDetraibile: 1, ivaPredefinita: 22 },
  Hardware: {
    deducibile: 1,
    ivaDetraibile: 1,
    ivaPredefinita: 22,
    nota: `Fino a ${SOGLIA_BENI_STRUMENTALI.toLocaleString("it-IT")} € netti si deduce tutto; oltre, la quota di ammortamento del 20% l'anno.`,
  },
  Formazione: { deducibile: 1, ivaDetraibile: 1, ivaPredefinita: 22, nota: "Fino a 10.000 € l'anno." },
  Marketing: { deducibile: 1, ivaDetraibile: 1, ivaPredefinita: 22 },
  Trasporti: { deducibile: 1, ivaDetraibile: 1, ivaPredefinita: 10, nota: "Treni, aerei e mezzi pubblici per lavoro." },
  "Auto e carburante": { deducibile: 0.2, ivaDetraibile: 0.4, ivaPredefinita: 22, nota: "Auto non esclusivamente strumentale: 20% del costo, 40% dell'IVA." },
  "Vitto e alloggio": { deducibile: 0.75, ivaDetraibile: 1, ivaPredefinita: 10, nota: "75% della spesa." },
  "Telefono e internet": { deducibile: 0.8, ivaDetraibile: 0.5, ivaPredefinita: 22, nota: "80% del costo, 50% dell'IVA." },
  Commercialista: { deducibile: 1, ivaDetraibile: 1, ivaPredefinita: 22 },
  Banca: { deducibile: 1, ivaDetraibile: 0, ivaPredefinita: 0 },
  "Tasse e contributi": {
    deducibile: 0,
    ivaDetraibile: 0,
    ivaPredefinita: 0,
    nota: "Esclusi dal calcolo: i contributi INPS li stima già l'app, IRPEF e IVA non sono costi.",
  },
  Altro: { deducibile: 0, ivaDetraibile: 0, ivaPredefinita: 22, nota: "Non dedotto: scegli una categoria precisa per dedurlo." },
};

const UNKNOWN_RULE: CostRule = { deducibile: 0, ivaDetraibile: 0, ivaPredefinita: 22, nota: "Categoria personalizzata: non dedotta." };

export function costRule(category: string): CostRule {
  return COST_RULES[category] ?? UNKNOWN_RULE;
}

/** IVA proposta per le entrate (fatture con IVA ordinaria; rimborsi fuori campo). */
export function incomeIva(category: string): IvaRate {
  return category === "Rimborsi" ? 0 : 22;
}

export interface Movement {
  kind: "entrata" | "uscita";
  amount: number; // lordo, IVA inclusa
  iva?: number; // aliquota %
  category: string;
}

export interface OrdinarioTotals {
  ricavi: number; // entrate al netto di IVA
  costiDeducibili: number;
  ivaVendite: number;
  ivaAcquistiDetraibile: number;
}

/** Ricavi, costi deducibili e IVA di un insieme di movimenti. */
export function ordinarioTotals(movements: Movement[]): OrdinarioTotals {
  const t: OrdinarioTotals = { ricavi: 0, costiDeducibili: 0, ivaVendite: 0, ivaAcquistiDetraibile: 0 };
  for (const m of movements) {
    const { netto, iva } = splitIva(m.amount, m.iva ?? 0);
    if (m.kind === "entrata") {
      t.ricavi += netto;
      t.ivaVendite += iva;
      continue;
    }
    const rule = costRule(m.category);
    const ivaDetraibile = iva * rule.ivaDetraibile;
    // L'IVA che non si detrae diventa parte del costo.
    const costo = netto + (iva - ivaDetraibile);
    let deducibile = costo * rule.deducibile;
    if (m.category === "Hardware" && netto > SOGLIA_BENI_STRUMENTALI) deducibile = costo * AMMORTAMENTO_HARDWARE;
    t.costiDeducibili += deducibile;
    t.ivaAcquistiDetraibile += ivaDetraibile;
  }
  return t;
}

// ─── IRPEF 2026 ─────────────────────────────────────────────────

/** Scaglioni IRPEF 2026 (L. 199/2025): 23% fino a 28.000 €, 33% fino a 50.000 €, 43% oltre. */
export const IRPEF_2026 = [
  { fino: 28_000, aliquota: 0.23 },
  { fino: 50_000, aliquota: 0.33 },
  { fino: Infinity, aliquota: 0.43 },
];

/** IRPEF lorda annua su un reddito imponibile (senza detrazioni). */
export function irpef(imponibile: number): number {
  let tax = 0;
  let prev = 0;
  for (const s of IRPEF_2026) {
    if (imponibile <= prev) break;
    tax += (Math.min(imponibile, s.fino) - prev) * s.aliquota;
    prev = s.fino;
  }
  // Oltre 200.000 € il beneficio del 33% viene recuperato riducendo le detrazioni, fino a 440 €.
  if (imponibile > 200_000) tax += 440;
  return tax;
}

export interface OrdinarioSettings extends InpsSettings {
  addizionale_regionale: number; // es. 0.0123
  addizionale_comunale: number; // es. 0.008
}

export interface OrdinarioEstimate {
  ricavi: number;
  costiDeducibili: number;
  reddito: number;
  contributi: number;
  contributiFissi: number;
  imponibileIrpef: number;
  irpef: number;
  addizionali: number;
  iva: number; // IVA da versare (vendite − acquisti detraibili)
}

interface Cumulative {
  reddito: number;
  contributiVariabili: number;
  contributiFissi: number;
  base: number;
  irpef: number;
  addizionali: number;
}

/** Valori annui progressivi dati i movimenti dall'inizio dell'anno e la frazione d'anno trascorsa. */
function cumulative(t: OrdinarioTotals, quota: number, s: OrdinarioSettings): Cumulative {
  const reddito = Math.max(0, t.ricavi - t.costiDeducibili);
  const contributiVariabili = variableContributions(reddito, s);
  const contributiFissi = fixedContributionsYear(s) * Math.min(1, Math.max(0, quota));
  // I contributi previdenziali obbligatori si deducono dal reddito complessivo.
  const base = Math.max(0, reddito - contributiVariabili - contributiFissi);
  return {
    reddito,
    contributiVariabili,
    contributiFissi,
    base,
    irpef: irpef(base),
    addizionali: base * (s.addizionale_regionale + s.addizionale_comunale),
  };
}

const sum = (a: OrdinarioTotals, b: OrdinarioTotals): OrdinarioTotals => ({
  ricavi: a.ricavi + b.ricavi,
  costiDeducibili: a.costiDeducibili + b.costiDeducibili,
  ivaVendite: a.ivaVendite + b.ivaVendite,
  ivaAcquistiDetraibile: a.ivaAcquistiDetraibile + b.ivaAcquistiDetraibile,
});

/**
 * Stima per un periodo dell'anno. Le parti progressive (contributi, IRPEF, addizionali) sono la
 * differenza tra il valore annuo a fine periodo e quello a inizio periodo; in un periodo in perdita
 * valgono zero (il recupero si vede nella stima da inizio anno).
 * - prima: movimenti dell'anno prima del periodo; quotaPrima: frazione d'anno già trascorsa
 * - periodo: movimenti del periodo; quotaPeriodo: frazione d'anno coperta dal periodo
 */
export function estimateOrdinario(
  prima: OrdinarioTotals,
  periodo: OrdinarioTotals,
  quotaPrima: number,
  quotaPeriodo: number,
  s: OrdinarioSettings,
): OrdinarioEstimate {
  const a = cumulative(prima, quotaPrima, s);
  const b = cumulative(sum(prima, periodo), quotaPrima + quotaPeriodo, s);
  const contributiFissi = b.contributiFissi - a.contributiFissi;
  const contributi = Math.max(0, b.contributiVariabili - a.contributiVariabili) + contributiFissi;
  return {
    ricavi: r2(periodo.ricavi),
    costiDeducibili: r2(periodo.costiDeducibili),
    reddito: r2(periodo.ricavi - periodo.costiDeducibili),
    contributi: r2(contributi),
    contributiFissi: r2(contributiFissi),
    imponibileIrpef: r2(Math.max(0, b.base - a.base)),
    irpef: r2(Math.max(0, b.irpef - a.irpef)),
    addizionali: r2(Math.max(0, b.addizionali - a.addizionali)),
    iva: r2(periodo.ivaVendite - periodo.ivaAcquistiDetraibile),
  };
}

export const EMPTY_TOTALS: OrdinarioTotals = { ricavi: 0, costiDeducibili: 0, ivaVendite: 0, ivaAcquistiDetraibile: 0 };
