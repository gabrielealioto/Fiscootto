// Coefficienti di redditività del regime forfettario per gruppo di attività ATECO
// (Legge 190/2014, allegato 4, come modificato dalla Legge 208/2015).
// La tabella ufficiale è espressa per divisioni e gruppi ATECO 2007. Dal 2025 sono in
// vigore i codici ATECO 2025, che hanno spostato alcune attività (soprattutto nel
// commercio, divisioni 45–47): per quei codici l'app chiede conferma all'utente.
// È un aiuto alla compilazione: il coefficiente resta sempre modificabile a mano.

export interface AtecoGroup {
  id: string;
  label: string;
  coefficiente: number;
}

export const ATECO_GROUPS: AtecoGroup[] = [
  { id: "alimentari", label: "Industrie alimentari e delle bevande", coefficiente: 0.4 },
  { id: "commercio", label: "Commercio all'ingrosso e al dettaglio", coefficiente: 0.4 },
  { id: "ambulante-alimentari", label: "Commercio ambulante di prodotti alimentari e bevande", coefficiente: 0.4 },
  { id: "ambulante-altro", label: "Commercio ambulante di altri prodotti", coefficiente: 0.54 },
  { id: "costruzioni", label: "Costruzioni e attività immobiliari", coefficiente: 0.86 },
  { id: "intermediari", label: "Intermediari del commercio", coefficiente: 0.62 },
  { id: "alloggio", label: "Servizi di alloggio e ristorazione", coefficiente: 0.4 },
  {
    id: "professionali",
    label: "Attività professionali, scientifiche, tecniche, sanitarie, di istruzione, servizi finanziari e assicurativi",
    coefficiente: 0.78,
  },
  { id: "altre", label: "Altre attività economiche", coefficiente: 0.67 },
];

const byId = (id: string) => ATECO_GROUPS.find((g) => g.id === id)!;

export type AtecoResult =
  | { status: "invalid"; message: string }
  | { status: "ok"; code: string; group: AtecoGroup; note?: string }
  | { status: "choose"; code: string; options: AtecoGroup[]; note: string };

/** Solo le cifre del codice: "62.01.00", "620100", "62 01" → "620100". */
export function atecoDigits(input: string): string {
  return input.replace(/[^\d]/g, "");
}

/** Formato standard con i punti: "620100" → "62.01.00", "6201" → "62.01". */
export function formatAteco(input: string): string {
  const d = atecoDigits(input).slice(0, 6);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)].filter(Boolean).join(".");
}

const inRange = (n: number, a: number, b: number) => n >= a && n <= b;

/** Trova il gruppo del forfettario (e quindi il coefficiente) per un codice ATECO. */
export function lookupAteco(input: string): AtecoResult {
  const d = atecoDigits(input);
  if (d.length < 2) return { status: "invalid", message: "Scrivi almeno le prime due cifre del codice (es. 62.01.00)." };
  if (d.length > 6) return { status: "invalid", message: "Un codice ATECO ha al massimo 6 cifre (es. 62.01.00)." };

  const code = formatAteco(d);
  const div = Number(d.slice(0, 2));
  const group3 = d.length >= 3 ? Number(d.slice(0, 3)) : null; // es. 461 = 46.1
  const class4 = d.length >= 4 ? Number(d.slice(0, 4)) : null; // es. 4781 = 47.81

  if (div < 1 || div > 99) return { status: "invalid", message: "Codice ATECO non riconosciuto." };

  if (inRange(div, 10, 11)) return { status: "ok", code, group: byId("alimentari") };
  if (inRange(div, 41, 43) || div === 68) return { status: "ok", code, group: byId("costruzioni") };
  if (inRange(div, 55, 56)) return { status: "ok", code, group: byId("alloggio") };
  if (inRange(div, 64, 66) || inRange(div, 69, 75) || inRange(div, 85, 88)) {
    return { status: "ok", code, group: byId("professionali") };
  }

  const commerceNote =
    "Nel commercio i codici ATECO 2025 sono cambiati rispetto alla tabella ufficiale (basata su ATECO 2007): controlla il gruppo con il commercialista.";

  if (div === 45) return { status: "ok", code, group: byId("commercio"), note: commerceNote };

  if (div === 46) {
    if (group3 === null) {
      return { status: "choose", code, options: [byId("commercio"), byId("intermediari")], note: "Scrivi anche la terza cifra, oppure scegli il gruppo." };
    }
    if (group3 === 461) return { status: "ok", code, group: byId("intermediari"), note: commerceNote };
    return { status: "ok", code, group: byId("commercio"), note: commerceNote };
  }

  if (div === 47) {
    if (group3 !== null && group3 !== 478) return { status: "ok", code, group: byId("commercio"), note: commerceNote };
    if (class4 === 4781) {
      return { status: "choose", code, options: [byId("ambulante-alimentari"), byId("commercio")], note: commerceNote };
    }
    if (class4 !== null && inRange(class4, 4782, 4789)) {
      return { status: "choose", code, options: [byId("ambulante-altro"), byId("commercio")], note: commerceNote };
    }
    return {
      status: "choose",
      code,
      options: [byId("commercio"), byId("ambulante-alimentari"), byId("ambulante-altro")],
      note: commerceNote,
    };
  }

  return { status: "ok", code, group: byId("altre") };
}
