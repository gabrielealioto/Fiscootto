"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchTransactions } from "@/lib/data";
import { atecoDigits, formatAteco } from "@/lib/ateco";
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
  const row = cleanRow({
    date: String(form.get("date") ?? ""),
    kind: String(form.get("kind") ?? "") as Kind,
    amount: Number(normalized),
    category: String(form.get("category") ?? ""),
    description: String(form.get("description") ?? ""),
  });
  if (!row) return { ok: false, message: "Controlla data e importo (maggiore di zero)." };

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

  const clean = rows.map(cleanRow).filter((r): r is ParsedRow => r !== null);
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("settings").upsert({
    user_id: user!.id,
    coefficiente: round4(coefficiente),
    aliquota_contributi: round4(aliquota_contributi),
    aliquota_imposta: round4(aliquota_imposta),
    ateco,
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
