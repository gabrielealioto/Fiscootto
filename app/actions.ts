"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchTransactions } from "@/lib/data";
import { atecoDigits, formatAteco } from "@/lib/ateco";
import { fetchSettings } from "@/lib/data";
import { GESTIONI, hasFixedContributions, type Gestione } from "@/lib/inps";
import { costRule, incomeIva, IVA_RATES } from "@/lib/ordinario";
import { dedupeKey, isIsoDate, round2, type Kind, type ParsedRow } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  ok?: boolean;
  message?: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

type Row = ParsedRow & { iva: number };

const validIva = (v: unknown) => ((IVA_RATES as readonly number[]).includes(Number(v)) ? Number(v) : null);

/** IVA proposta per categoria (regime ordinario); nel forfettario sempre 0. */
const defaultIva = (kind: Kind, category: string, ordinario: boolean) =>
  !ordinario ? 0 : kind === "entrata" ? incomeIva(category) : costRule(category).ivaPredefinita;

function cleanRow(r: Partial<ParsedRow>): ParsedRow | null {
  const kind = r.kind === "entrata" || r.kind === "uscita" ? (r.kind as Kind) : null;
  const amount = typeof r.amount === "number" ? round2(r.amount) : NaN;
  if (!kind || !r.date || !isIsoDate(r.date) || !Number.isFinite(amount) || amount <= 0 || amount >= 1e10) return null;
  return {
    date: r.date,
    kind,
    amount,
    category: (r.category ?? "").trim().slice(0, 60) || "Altro",
    description: (r.description ?? "").trim().slice(0, 300),
  };
}

export async function addTransaction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await requireUser();
  const raw = String(form.get("amount") ?? "").replace(/\s/g, "");
  // Accetta sia "12,50" sia "12.50" e "1.234,56".
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const clean = cleanRow({
    date: String(form.get("date") ?? ""),
    kind: String(form.get("kind") ?? "") as Kind,
    amount: Number(normalized),
    category: String(form.get("category") ?? ""),
    description: String(form.get("description") ?? ""),
  });
  if (!clean) return { ok: false, message: "Controlla data e importo (maggiore di zero)." };
  const { regime } = await fetchSettings(supabase);
  const ordinario = regime === "ordinario";
  const iva = ordinario ? (validIva(form.get("iva")) ?? defaultIva(clean.kind, clean.category, true)) : 0;
  const row: Row = { ...clean, iva };

  const { error } = await supabase.from("transactions").insert(row);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true, message: "Movimento salvato." };
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = await requireUser();
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/");
}

const MAX_IMPORT = 5000;

export async function importTransactions(rows: ParsedRow[]): Promise<ActionState & { inserted?: number; skipped?: number }> {
  const supabase = await requireUser();
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: "Nessuna riga da importare." };
  if (rows.length > MAX_IMPORT) return { ok: false, message: `Massimo ${MAX_IMPORT} righe per import.` };

  const { regime } = await fetchSettings(supabase);
  const ordinario = regime === "ordinario";
  // Il CSV della banca non dice l'IVA: nel regime ordinario si propone quella tipica della categoria.
  const clean: Row[] = rows
    .map(cleanRow)
    .filter((r): r is ParsedRow => r !== null)
    .map((r) => ({ ...r, iva: defaultIva(r.kind, r.category, ordinario) }));
  if (clean.length === 0) return { ok: false, message: "Nessuna riga valida." };

  // Salta i movimenti già presenti (stessa data, tipo, importo e descrizione):
  // così si può reimportare lo stesso estratto conto senza duplicati.
  const dates = clean.map((r) => r.date).sort();
  let existing;
  try {
    existing = await fetchTransactions(supabase, { start: dates[0], end: dates[dates.length - 1] });
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const seen = new Set(existing.map(dedupeKey));
  const fresh: ParsedRow[] = [];
  for (const r of clean) {
    const k = dedupeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push(r);
  }

  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase.from("transactions").insert(fresh.slice(i, i + 500));
    if (error) return { ok: false, message: `Import interrotto: ${error.message}`, inserted: i };
  }
  revalidatePath("/");
  const skipped = rows.length - fresh.length;
  return {
    ok: true,
    inserted: fresh.length,
    skipped,
    message: `Importati ${fresh.length} movimenti${skipped ? `, ${skipped} saltati (già presenti o non validi)` : ""}.`,
  };
}

export async function saveSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await requireUser();
  const pct = (name: string) => Number(String(form.get(name) ?? "").replace(",", ".")) / 100;
  const coefficiente = pct("coefficiente");
  const aliquota_contributi = pct("aliquota_contributi");
  const aliquota_imposta = pct("aliquota_imposta");

  if (!(coefficiente > 0 && coefficiente <= 1)) return { ok: false, message: "Coefficiente tra 1 e 100%." };
  if (!(aliquota_contributi >= 0 && aliquota_contributi < 1)) return { ok: false, message: "Aliquota contributi tra 0 e 99%." };
  if (!(aliquota_imposta >= 0 && aliquota_imposta < 1)) return { ok: false, message: "Imposta sostitutiva tra 0 e 99%." };
  const atecoRaw = String(form.get("ateco") ?? "").trim();
  const digits = atecoDigits(atecoRaw);
  if (atecoRaw && (digits.length < 2 || digits.length > 6 || digits.length % 2 !== 0)) {
    return { ok: false, message: "Codice ATECO non valido: usa il formato 62.01.00." };
  }
  const ateco = digits ? formatAteco(digits) : "";
  const gestioneRaw = String(form.get("gestione") ?? "separata");
  if (!(GESTIONI as string[]).includes(gestioneRaw)) return { ok: false, message: "Gestione previdenziale non valida." };
  const gestione = gestioneRaw as Gestione;
  const regime = form.get("regime") === "ordinario" ? "ordinario" : "forfettario";
  // La riduzione del 35% è riservata ai forfettari.
  const riduzione_35 = regime === "forfettario" && hasFixedContributions(gestione) && form.get("riduzione_35") === "on";
  const addizionale_regionale = form.has("addizionale_regionale") ? pct("addizionale_regionale") : 0.0123;
  const addizionale_comunale = form.has("addizionale_comunale") ? pct("addizionale_comunale") : 0.008;
  if (!(addizionale_regionale >= 0 && addizionale_regionale <= 0.05)) return { ok: false, message: "Addizionale regionale tra 0 e 5%." };
  if (!(addizionale_comunale >= 0 && addizionale_comunale <= 0.02)) return { ok: false, message: "Addizionale comunale tra 0 e 2%." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("settings").upsert({
    user_id: user!.id,
    coefficiente: round4(coefficiente),
    aliquota_contributi: round4(aliquota_contributi),
    aliquota_imposta: round4(aliquota_imposta),
    ateco,
    gestione,
    riduzione_35,
    regime,
    addizionale_regionale: round4(addizionale_regionale),
    addizionale_comunale: round4(addizionale_comunale),
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Impostazioni salvate." };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export async function deleteReport(id: string): Promise<void> {
  const supabase = await requireUser();
  await supabase.from("reports").delete().eq("id", id);
  revalidatePath("/reports");
}
