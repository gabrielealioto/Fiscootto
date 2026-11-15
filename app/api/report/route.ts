import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { fetchSettings, fetchTransactions } from "@/lib/data";
import { dataRange, isIsoDate, PERIODS, summarize, todayRome, type Period } from "@/lib/finance";
import { buildReportPrompt, REPORT_SYSTEM_PROMPT } from "@/lib/report";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { period?: string; date?: string };
  const period = (PERIODS as string[]).includes(body.period ?? "") ? (body.period as Period) : "mese";
  const date = body.date && isIsoDate(body.date) ? body.date : todayRome();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurata sul server." }, { status: 500 });
  }

  let txs, settings;
  try {
    [txs, settings] = await Promise.all([fetchTransactions(supabase, dataRange(period, date)), fetchSettings(supabase)]);
  } catch (e) {
    return NextResponse.json({ error: `Errore nel leggere i dati: ${(e as Error).message}` }, { status: 500 });
  }

  const summary = summarize(txs, period, date, settings);
  if (summary.current.movimenti === 0 && summary.previous.movimenti === 0) {
    return NextResponse.json(
      { error: "Non ci sono movimenti in questo periodo né in quello precedente: aggiungine qualcuno prima di generare il report." },
      { status: 400 },
    );
  }

  const client = new Anthropic();
  let content: string;
  let servedBy = MODEL;
  try {
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        // Se il modello declina per i filtri di sicurezza, l'API riprova da sola su un modello di riserva.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: REPORT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildReportPrompt(summary, txs, settings) }],
      })
      .finalMessage();

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "Il modello non ha potuto generare il report. Riprova più tardi." }, { status: 502 });
    }
    servedBy = message.model;
    content = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!content) throw new Error("Risposta vuota");
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Chiave Anthropic non valida." }, { status: 500 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Troppe richieste: riprova tra qualche minuto." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Errore dell'API Anthropic (${e.status ?? "rete"}).` }, { status: 502 });
    }
    return NextResponse.json({ error: `Errore nella generazione: ${(e as Error).message}` }, { status: 500 });
  }

  const { data: saved, error } = await supabase
    .from("reports")
    .insert({
      period,
      period_start: summary.range.start,
      period_end: summary.range.end,
      content,
      model: servedBy,
    })
    .select("id, period, period_start, period_end, content, created_at")
    .single();

  if (error) {
    // Il report c'è comunque: lo restituiamo anche se il salvataggio fallisce.
    return NextResponse.json({ report: { id: null, period, period_start: summary.range.start, period_end: summary.range.end, content }, warning: `Report non salvato: ${error.message}` });
  }
  return NextResponse.json({ report: saved });
}
