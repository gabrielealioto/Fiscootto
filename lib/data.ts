import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type Range, type TaxSettings, type Transaction } from "./finance";
import { GESTIONI, type Gestione } from "./inps";

const PAGE = 1000; // limite di righe per richiesta di PostgREST

/** Tutti i movimenti dell'utente nell'intervallo (paginando oltre le 1000 righe). */
export async function fetchTransactions(supabase: SupabaseClient, range: Range): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, date, kind, amount, category, description, iva")
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.push({ ...r, amount: Number(r.amount), iva: Number(r.iva ?? 0) } as Transaction);
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export type UserSettings = TaxSettings & { ateco: string };

export async function fetchSettings(supabase: SupabaseClient): Promise<UserSettings> {
  const { data } = await supabase
    .from("settings")
    .select("coefficiente, aliquota_contributi, aliquota_imposta, ateco, gestione, riduzione_35, regime, addizionale_regionale, addizionale_comunale")
    .maybeSingle();
  if (!data) return { ...DEFAULT_SETTINGS, ateco: "" };
  return {
    coefficiente: Number(data.coefficiente),
    aliquota_contributi: Number(data.aliquota_contributi),
    aliquota_imposta: Number(data.aliquota_imposta),
    ateco: data.ateco ?? "",
    gestione: (GESTIONI as string[]).includes(data.gestione) ? (data.gestione as Gestione) : "separata",
    riduzione_35: !!data.riduzione_35,
    regime: data.regime === "ordinario" ? "ordinario" : "forfettario",
    addizionale_regionale: Number(data.addizionale_regionale ?? DEFAULT_SETTINGS.addizionale_regionale),
    addizionale_comunale: Number(data.addizionale_comunale ?? DEFAULT_SETTINGS.addizionale_comunale),
  };
}
