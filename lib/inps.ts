// Gestioni previdenziali INPS per chi ha partita IVA nel regime forfettario, valori 2026.
// Fonti: Gestione Separata, circolare INPS n. 8 del 3/2/2026; Artigiani e Commercianti,
// circolare INPS n. 14 del 9/2/2026. Da aggiornare ogni anno.

export type Gestione = "separata" | "separata_ridotta" | "artigiani" | "commercianti" | "cassa";

export const GESTIONI: Gestione[] = ["separata", "separata_ridotta", "artigiani", "commercianti", "cassa"];

export interface GestioneInfo {
  id: Gestione;
  label: string;
  hint: string;
  /** Aliquota proposta quando si sceglie la gestione (modificabile); null = la inserisce l'utente. */
  aliquota: number | null;
  /** Aliquota oltre la soglia (solo artigiani e commercianti). */
  aliquotaAlta?: number;
  /** Reddito oltre il quale si applica l'aliquota alta. */
  soglia?: number;
  /** Reddito minimale su cui si pagano i contributi fissi. */
  minimale: number;
  /** Contributi fissi annui sul minimale (inclusa la maternità). */
  fissi: number;
  /** Massimale di reddito oltre il quale non si pagano contributi (null = nessuno). */
  massimale: number | null;
}

/** Massimale 2026 (Gestione Separata e iscritti dal 1996 ad artigiani e commercianti). */
export const MASSIMALE_2026 = 122_295;
/** Riduzione del 35% dei contributi riservata ai forfettari artigiani e commercianti (L. 190/2014, c. 77). */
export const RIDUZIONE_FORFETTARI = 0.35;

export const GESTIONE_INFO: Record<Gestione, GestioneInfo> = {
  separata: {
    id: "separata",
    label: "Gestione Separata",
    hint: "Professionisti senza cassa propria",
    aliquota: 0.2607,
    minimale: 0,
    fissi: 0,
    massimale: MASSIMALE_2026,
  },
  separata_ridotta: {
    id: "separata_ridotta",
    label: "Gestione Separata · aliquota ridotta",
    hint: "Già pensionati o iscritti ad altra previdenza obbligatoria",
    aliquota: 0.24,
    minimale: 0,
    fissi: 0,
    massimale: MASSIMALE_2026,
  },
  artigiani: {
    id: "artigiani",
    label: "Artigiani",
    hint: "Contributi fissi sul minimale più una percentuale sull'eccedenza",
    aliquota: 0.24,
    aliquotaAlta: 0.25,
    soglia: 56_224,
    minimale: 18_808,
    fissi: 4_521.36,
    massimale: MASSIMALE_2026,
  },
  commercianti: {
    id: "commercianti",
    label: "Commercianti",
    hint: "Contributi fissi sul minimale più una percentuale sull'eccedenza",
    aliquota: 0.2448,
    aliquotaAlta: 0.2548,
    soglia: 56_224,
    minimale: 18_808,
    fissi: 4_611.64,
    massimale: MASSIMALE_2026,
  },
  cassa: {
    id: "cassa",
    label: "Cassa professionale",
    hint: "Ordini con cassa propria: inserisci l'aliquota della tua cassa",
    aliquota: null,
    minimale: 0,
    fissi: 0,
    massimale: null,
  },
};

export const hasFixedContributions = (g: Gestione) => g === "artigiani" || g === "commercianti";

export interface InpsSettings {
  gestione?: Gestione;
  aliquota_contributi: number;
  riduzione_35?: boolean;
}

/** Riduzione applicabile: solo artigiani e commercianti che l'hanno richiesta. */
function reductionFactor(s: InpsSettings): number {
  return s.riduzione_35 && hasFixedContributions(s.gestione ?? "separata") ? 1 - RIDUZIONE_FORFETTARI : 1;
}

/**
 * Contributi in percentuale dovuti su un reddito imponibile annuo (esclusi i fissi).
 * - Gestione Separata e cassa: aliquota su tutto l'imponibile fino al massimale.
 * - Artigiani e commercianti: aliquota sulla parte oltre il minimale, più alta oltre la soglia.
 */
export function variableContributions(imponibile: number, s: InpsSettings): number {
  const g = GESTIONE_INFO[s.gestione ?? "separata"];
  const base = Math.max(0, g.massimale === null ? imponibile : Math.min(imponibile, g.massimale));
  if (!hasFixedContributions(g.id)) return base * s.aliquota_contributi * reductionFactor(s);

  const eccedenza = Math.max(0, base - g.minimale);
  const sottoSoglia = Math.min(eccedenza, Math.max(0, (g.soglia ?? Infinity) - g.minimale));
  const sopraSoglia = eccedenza - sottoSoglia;
  // L'aliquota alta è quella proposta + 1 punto, anche se l'utente ha modificato quella base.
  const alta = s.aliquota_contributi + ((g.aliquotaAlta ?? 0) - (g.aliquota ?? 0));
  return (sottoSoglia * s.aliquota_contributi + sopraSoglia * alta) * reductionFactor(s);
}

/** Contributi fissi annui (solo artigiani e commercianti), al netto dell'eventuale riduzione. */
export function fixedContributionsYear(s: InpsSettings): number {
  const g = GESTIONE_INFO[s.gestione ?? "separata"];
  return hasFixedContributions(g.id) ? g.fissi * reductionFactor(s) : 0;
}
