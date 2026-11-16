"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isIsoDate, round2, todayRome, type Kind } from "@/lib/finance";
import { IVA_RATES } from "@/lib/ordinario";
import { FREQUENCIES, nextOccurrence, type Frequency, type Scope } from "@/lib/planning";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./actions";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const done = (message: string): ActionState => {
  revalidatePath("/", "layout");
  return { ok: true, message };
};
const fail = (message: string): ActionState => ({ ok: false, message });

const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);
const scopeOf = (f: FormData): Scope => (f.get("scope") === "life" ? "life" : "work");
const kindOf = (f: FormData): Kind => (f.get("kind") === "entrata" ? "entrata" : "uscita");
/** "1.234,56", "1234.56", "12,5" → numero. */
function money(f: FormData, k: string): number {
  const raw = String(f.get(k) ?? "").replace(/[\s€]/g, "");
  const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(n) ? round2(n) : NaN;
}

// ─── Categorie ─────────────────────────────────────────────────

export async function saveCategory(_p: ActionState, f: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = str(f, "name", 60);
  if (!name) return fail("Scrivi il nome della categoria.");
  const pct = money(f, "deducibile");
  const deducibile = Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : 1;
  const { error } = await supabase.from("categories").insert({ scope: scopeOf(f), kind: kindOf(f), name, deducibile });
  if (error) return fail(error.code === "23505" ? "Esiste già una categoria con questo nome." : error.message);
  return done(`Categoria "${name}" aggiunta.`);
}

export async function deleteCategory(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// ─── Regole automatiche ────────────────────────────────────────

export async function saveRule(_p: ActionState, f: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const pattern = str(f, "pattern", 80);
  const category = str(f, "category", 60);
  if (pattern.length < 2) return fail("Il testo da cercare deve avere almeno 2 caratteri.");
  if (!category) return fail("Scegli la categoria.");
  const { error } = await supabase.from("category_rules").insert({ pattern, category, scope: scopeOf(f), kind: kindOf(f) });
  if (error) return fail(error.message);
  return done(`Regola salvata: "${pattern}" → ${category}.`);
}

export async function deleteRule(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("category_rules").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// ─── Budget ────────────────────────────────────────────────────

export async function saveBudget(_p: ActionState, f: FormData): Promise<ActionState> {
  const { supabase, userId } = await requireUser();
  const category = str(f, "category", 60);
  const monthly_limit = money(f, "monthly_limit");
  if (!category) return fail("Scegli la categoria.");
  if (!(monthly_limit > 0)) return fail("Il tetto mensile deve essere maggiore di zero.");
  const { error } = await supabase
    .from("budgets")
    .upsert({ user_id: userId, scope: scopeOf(f), category, monthly_limit }, { onConflict: "user_id,scope,category" });
  if (error) return fail(error.message);
  return done(`Budget per ${category} salvato.`);
}

export async function deleteBudget(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("budgets").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// ─── Spese ricorrenti ──────────────────────────────────────────

export async function saveRecurring(_p: ActionState, f: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = str(f, "id", 64);
  const name = str(f, "name", 80);
  const category = str(f, "category", 60);
  const amount = money(f, "amount");
  const frequency = String(f.get("frequency") ?? "") as Frequency;
  const next_date = String(f.get("next_date") ?? "");
  const ivaRaw = Number(f.get("iva") ?? 0);
  const iva = (IVA_RATES as readonly number[]).includes(ivaRaw) ? ivaRaw : 0;
  if (!name) return fail("Dai un nome alla spesa ricorrente.");
  if (!(amount > 0)) return fail("L'importo deve essere maggiore di zero.");
  if (!FREQUENCIES.includes(frequency)) return fail("Scegli la frequenza.");
  if (!isIsoDate(next_date)) return fail("Indica la data della prossima scadenza.");
  const row = { name, category: category || "Altro", amount, frequency, next_date, iva, scope: scopeOf(f), kind: kindOf(f), active: true };
  const { error } = id ? await supabase.from("recurring").update(row).eq("id", id) : await supabase.from("recurring").insert(row);
  if (error) return fail(error.message);
  return done(id ? `${name} aggiornata.` : `${name} aggiunta alle ricorrenti.`);
}

export async function deleteRecurring(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("recurring").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function toggleRecurring(id: string, active: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("recurring").update({ active }).eq("id", id);
  revalidatePath("/", "layout");
}

/** Registra il pagamento: crea il movimento e sposta la scadenza al periodo successivo. */
export async function payRecurring(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { data: r, error } = await supabase
    .from("recurring")
    .select("id, name, scope, kind, amount, category, iva, frequency, next_date")
    .eq("id", id)
    .single();
  if (error || !r) return fail("Spesa ricorrente non trovata.");
  const today = todayRome();
  const date = r.next_date <= today ? r.next_date : today;
  const ins = await supabase.from("transactions").insert({
    date,
    kind: r.kind,
    amount: Number(r.amount),
    category: r.category,
    description: r.name,
    iva: Number(r.iva),
    scope: r.scope,
  });
  if (ins.error) return fail(ins.error.message);
  const anchor = Number(String(r.next_date).slice(8, 10));
  const next = nextOccurrence(r.next_date, r.frequency as Frequency, anchor);
  await supabase.from("recurring").update({ next_date: next }).eq("id", id);
  return done(`${r.name} registrata. Prossima scadenza: ${next.split("-").reverse().join("/")}.`);
}

// ─── Obiettivi di risparmio ────────────────────────────────────

export async function saveGoal(_p: ActionState, f: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = str(f, "id", 64);
  const name = str(f, "name", 80);
  const target = money(f, "target");
  const saved = f.has("saved") ? money(f, "saved") : 0;
  const deadlineRaw = String(f.get("deadline") ?? "");
  const deadline = isIsoDate(deadlineRaw) ? deadlineRaw : null;
  if (!name) return fail("Dai un nome all'obiettivo.");
  if (!(target > 0)) return fail("Il traguardo deve essere maggiore di zero.");
  const row = { name, target, deadline, ...(Number.isFinite(saved) && saved >= 0 && !id ? { saved } : {}) };
  const { error } = id ? await supabase.from("goals").update(row).eq("id", id) : await supabase.from("goals").insert(row);
  if (error) return fail(error.message);
  return done(id ? `Obiettivo aggiornato.` : `Obiettivo "${name}" creato.`);
}

export async function deleteGoal(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("goals").delete().eq("id", id);
  revalidatePath("/", "layout");
}

/** Aggiunge (positivo) o preleva (negativo) dal salvadanaio dell'obiettivo. */
export async function moveGoal(id: string, delta: number): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (!Number.isFinite(delta) || delta === 0) return fail("Importo non valido.");
  const { data: g } = await supabase.from("goals").select("saved").eq("id", id).single();
  if (!g) return fail("Obiettivo non trovato.");
  const saved = round2(Math.max(0, Number(g.saved) + delta));
  const { error } = await supabase.from("goals").update({ saved }).eq("id", id);
  if (error) return fail(error.message);
  return done(delta > 0 ? "Aggiunto all'obiettivo." : "Prelevato dall'obiettivo.");
}
