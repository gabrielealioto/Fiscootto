import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { fetchSettings, fetchTransactions } from "@/lib/data";
import { dataRange, isIsoDate, PERIODS, summarize, todayRome, type Period } from "@/lib/finance";
import { BASIC_MODEL, buildBasicReport, buildReportPrompt, REPORT_SYSTEM_PROMPT } from "@/lib/report";
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

  let content: string;
  let servedBy = MODEL;
  if (!process.env.ANTHROPIC_API_KEY) {
    // Senza chiave: report automatico a regole fisse, gratuito.
    content = buildBasicReport(summary, txs);
    servedBy = BASIC_MODEL;
  } else {
    const result = await generateWithClaude(buildReportPrompt(summary, txs, settings));
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    content = result.content;
    servedBy = result.model;
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
    .select("id, period, period_start, period_end, content, model, created_at")
    .single();

  if (error) {
    // Il report c'è comunque: lo restituiamo anche se il salvataggio fallisce.
    return NextResponse.json({ report: { id: null, period, period_start: summary.range.start, period_end: summary.range.end, content, model: servedBy }, warning: `Report non salvato: ${error.message}` });
  }
  return NextResponse.json({ report: saved });
}

type ClaudeResult = { content: string; model: string } | { error: string; status: number };

async function generateWithClaude(prompt: string): Promise<ClaudeResult> {
  const client = new Anthropic();
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
        messages: [{ role: "user", content: prompt }],
      })
      .finalMessage();

    if (message.stop_reason === "refusal") {
      return { error: "Il modello non ha potuto generare il report. Riprova più tardi.", status: 502 };
    }
    const content = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!content) return { error: "Il modello ha restituito una risposta vuota.", status: 502 };
    return { content, model: message.model };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: "Chiave Anthropic non valida.", status: 500 };
    if (e instanceof Anthropic.RateLimitError) return { error: "Troppe richieste: riprova tra qualche minuto.", status: 429 };
    if (e instanceof Anthropic.APIError) return { error: `Errore dell'API Anthropic (${e.status ?? "rete"}).`, status: 502 };
    return { error: `Errore nella generazione: ${(e as Error).message}`, status: 500 };
  }
}
