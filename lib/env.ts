// Le variabili NEXT_PUBLIC_ vengono inserite nel codice al momento della build:
// vanno lette con il nome scritto per intero (niente accessi dinamici).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Nomi delle variabili obbligatorie che mancano (vuoto se è tutto a posto). */
export function missingEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY.trim()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

/** Pagina di errore leggibile al posto di un 500 anonimo. */
export function configErrorPage(missing: string[]): string {
  const items = missing.map((m) => `<li><code>${m}</code></li>`).join("");
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiscootto – configurazione mancante</title>
<style>
:root{color-scheme:light dark;--bg:#f6f7f9;--fg:#15191e;--muted:#5d6673;--card:#fff;--border:#e2e5ea;--accent:#1f6f5c}
@media (prefers-color-scheme:dark){:root{--bg:#111418;--fg:#e8ebef;--muted:#9aa3ae;--card:#191d23;--border:#2c333c;--accent:#4fbf9f}}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:560px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px}
h1{font-size:1.3rem;margin:0 0 8px}p,li{color:var(--muted)}code{background:var(--bg);padding:1px 6px;border-radius:6px;color:var(--fg)}
ol{padding-left:20px}strong{color:var(--fg)}
</style></head><body><main>
<h1>Configurazione mancante</h1>
<p>Questa versione dell'app è stata pubblicata senza ${missing.length === 1 ? "questa variabile" : "queste variabili"}:</p>
<ul>${items}</ul>
<p><strong>Come risolvere su Vercel:</strong></p>
<ol>
<li><em>Settings → Environment Variables</em>: aggiungi la variabile e spunta l'ambiente <strong>Production</strong> (o tutti).</li>
<li><em>Deployments</em> → ultimo deploy → <em>⋯ → Redeploy</em>, scegliendo l'ambiente <strong>Production</strong>.</li>
</ol>
<p>Le variabili <code>NEXT_PUBLIC_</code> entrano nell'app durante la build: dopo averle aggiunte serve sempre un nuovo deploy.</p>
</main></body></html>`;
}
