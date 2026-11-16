import { Calculator } from "lucide-react";
import { SettingsForm } from "@/components/SettingsForm";
import { fetchSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const settings = await fetchSettings(supabase);
  return (
    <div className="stack-lg" style={{ maxWidth: 1040 }}>
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Profilo fiscale</div>
          <h1 className="page-title">Impostazioni</h1>
        </div>
      </header>
      <div className="settings-grid">
        <SettingsForm settings={settings} ateco={settings.ateco} />
        <aside className="card stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="kchip kind-tax">
              <Calculator size={19} />
            </span>
            <h2>Come calcolo le tasse</h2>
          </div>
          <ol className="formula">
            <li>
              <span>
                <strong style={{ color: "var(--fg)" }}>Imponibile</strong> = incassi × coefficiente di redditività.
              </span>
            </li>
            <li>
              <span>
                <strong style={{ color: "var(--fg)" }}>Contributi INPS</strong> = imponibile × aliquota contributi.
              </span>
            </li>
            <li>
              <span>
                <strong style={{ color: "var(--fg)" }}>Imposta</strong> = (imponibile − contributi) × imposta sostitutiva.
              </span>
            </li>
          </ol>
          <p className="small muted">
            Nel forfettario le spese non riducono le tasse: contano solo gli incassi. I contributi in realtà si deducono nell&apos;anno in
            cui li paghi, e artigiani e commercianti hanno anche una quota fissa: la stima serve per decidere quanto mettere da parte, non
            per la dichiarazione. Verifica sempre con il commercialista.
          </p>
        </aside>
      </div>
    </div>
  );
}
