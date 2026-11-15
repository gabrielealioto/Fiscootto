import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type Range, type TaxSettings, type Transaction } from "./finance";

const PAGE = 1000; // limite di righe per richiesta di PostgREST

/** Tutti i movimenti dell'utente nell'intervallo (paginando oltre le 1000 righe). */
export async function fetchTransactions(supabase: SupabaseClient, range: Range): Promise<Transaction[]> {
  const out: Transaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, date, kind, amount, category, description")
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.push({ ...r, amount: Number(r.amount) } as Transaction);
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function fetchSettings(supabase: SupabaseClient): Promise<TaxSettings> {
  const { data } = await supabase
    .from("settings")
    .select("coefficiente, aliquota_contributi, aliquota_imposta")
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    coefficiente: Number(data.coefficiente),
    aliquota_contributi: Number(data.aliquota_contributi),
    aliquota_imposta: Number(data.aliquota_imposta),
  };
}
