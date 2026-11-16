import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { fetchPlanning } from "@/lib/data";
import { isIsoDate, todayRome } from "@/lib/finance";
import { IVA_RATES } from "@/lib/ordinario";
import { categoriesFor } from "@/lib/planning";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];
const MAX_BASE64 = 6_000_000; // ~4,5 MB di immagine

export interface ReceiptData {
  date: string | null;
  total: number | null;
  merchant: string;
  description: string;
  scope: "work" | "life";
  category: string;
  iva: number;
  confidence: "alta" | "media" | "bassa";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "La lettura degli scontrini richiede una chiave Anthropic." }, { status: 501 });
  }

  const body = (await request.json().catch(() => null)) as { image?: string; mediaType?: string } | null;
  const image = body?.image ?? "";
  const mediaType = (MEDIA_TYPES as readonly string[]).includes(body?.mediaType ?? "") ? (body!.mediaType as MediaType) : null;
  if (!image || !mediaType || image.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return NextResponse.json({ error: "Immagine non valida o troppo grande." }, { status: 400 });
  }

  const { categories } = await fetchPlanning(supabase);
  const work = categoriesFor("work", "uscita", categories);
  const life = categoriesFor("life", "uscita", categories);
  const allCategories = [...new Set([...work, ...life])];
  const today = todayRome();

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["date", "total", "merchant", "description", "scope", "category", "iva", "confidence"],
    properties: {
      date: { type: ["string", "null"], description: "Data dello scontrino in formato YYYY-MM-DD, null se illeggibile" },
      total: { type: ["number", "null"], description: "Totale pagato in euro, IVA compresa, null se illeggibile" },
      merchant: { type: "string", description: "Nome del negozio o dell'esercente" },
      description: { type: "string", description: "Descrizione breve di cosa è stato comprato, max 60 caratteri" },
      scope: { type: "string", enum: ["work", "life"], description: "work se è una spesa per l'attività, life se personale" },
      category: { type: "string", enum: allCategories },
      iva: { type: "integer", enum: [...IVA_RATES], description: "Aliquota IVA prevalente; 0 se non indicata" },
      confidence: { type: "string", enum: ["alta", "media", "bassa"] },
    },
  };

  const prompt = `Leggi questo scontrino o ricevuta italiana ed estrai i dati per registrare la spesa.
Oggi è ${today}: se l'anno non si legge, usa quello più recente non nel futuro.
Il totale è l'importo pagato, IVA compresa (cerca "TOTALE", "TOTALE COMPLESSIVO", "IMPORTO PAGATO").
Categorie di lavoro (scope "work"): ${work.join(", ")}.
Categorie personali (scope "life"): ${life.join(", ")}.
Scegli scope e categoria in modo coerente. Se non si capisce se è una spesa di lavoro, usa "life".
Se un dato non si legge, mettilo a null e abbassa la confidenza.`;

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      // Se il modello declina per i filtri di sicurezza, l'API riprova da sola su un modello di riserva.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "Non sono riuscito a leggere lo scontrino." }, { status: 502 });
    }
    const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const raw = JSON.parse(text) as ReceiptData;

    // Il formato è garantito dallo schema; ricontrollo comunque i valori prima di usarli.
    const data: ReceiptData = {
      date: raw.date && isIsoDate(raw.date) && raw.date <= today ? raw.date : null,
      total: typeof raw.total === "number" && raw.total > 0 && raw.total < 1e7 ? Math.round(raw.total * 100) / 100 : null,
      merchant: String(raw.merchant ?? "").slice(0, 80),
      description: String(raw.description ?? "").slice(0, 120),
      scope: raw.scope === "work" ? "work" : "life",
      category: allCategories.includes(raw.category) ? raw.category : "Altro",
      iva: (IVA_RATES as readonly number[]).includes(raw.iva) ? raw.iva : 0,
      confidence: ["alta", "media", "bassa"].includes(raw.confidence) ? raw.confidence : "bassa",
    };
    return NextResponse.json({ receipt: data });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "Chiave Anthropic non valida." }, { status: 500 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Troppe richieste: riprova tra poco." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Errore dell'API Anthropic (${e.status ?? "rete"}).` }, { status: 502 });
    if (e instanceof SyntaxError) return NextResponse.json({ error: "Risposta non leggibile: riprova con una foto più nitida." }, { status: 502 });
    return NextResponse.json({ error: `Errore: ${(e as Error).message}` }, { status: 500 });
  }
}
