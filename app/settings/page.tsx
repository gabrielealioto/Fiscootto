import { Calculator } from "lucide-react";
import { SettingsForm } from "@/components/SettingsForm";
import { CategoryManager } from "@/components/CategoryManager";
import { fetchPlanning, fetchSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [settings, planning] = await Promise.all([fetchSettings(supabase), fetchPlanning(supabase)]);
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
          {settings.regime === "ordinario" ? (
            <>
              <ol className="formula">
                <li>
                  <span>
                    <strong style={{ color: "var(--fg)" }}>Reddito</strong> = incassi senza IVA − spese deducibili (ogni categoria con il suo
                    limite: materiali e merci 100%, telefono 80%, vitto e alloggio 75%, auto 20%).
                  </span>
                </li>
                <li>
                  <span>
                    <strong style={{ color: "var(--fg)" }}>Contributi INPS</strong> sul reddito, secondo la tua gestione.
                  </span>
                </li>
                <li>
                  <span>
                    <strong style={{ color: "var(--fg)" }}>IRPEF</strong> a scaglioni e <strong style={{ color: "var(--fg)" }}>addizionali</strong>{" "}
                    su reddito − contributi.
                  </span>
                </li>
                <li>
                  <span>
                    <strong style={{ color: "var(--fg)" }}>IVA da versare</strong> = IVA sulle vendite − IVA detraibile sugli acquisti.
                  </span>
                </li>
              </ol>
              <p className="small muted">
                Stima per decidere quanto mettere da parte: non considera detrazioni personali, crediti d&apos;imposta, rimanenze di magazzino
                né acconti già versati. Le spese si deducono quando le paghi (principio di cassa). Verifica sempre con il commercialista.
              </p>
            </>
          ) : (
            <>
              <ol className="formula">
            <li>
              <span>
                <strong style={{ color: "var(--fg)" }}>Imponibile</strong> = incassi × coefficiente di redditività.
              </span>
            </li>
            <li>
              <span>
                <strong style={{ color: "var(--fg)" }}>Contributi INPS</strong>: in Gestione Separata una percentuale dell&apos;imponibile fino al massimale; per artigiani e commercianti i contributi fissi più una percentuale sulla parte oltre il minimale.
              </span>
            </li>
            <li>
              <span>
                <strong style={{ color: "var(--fg)" }}>Imposta</strong> = (imponibile − contributi) × imposta sostitutiva.
              </span>
            </li>
          </ol>
          <p className="small muted">
            Nel forfettario le spese non riducono le tasse: contano solo gli incassi. I contributi fissi sono ripartiti sui giorni dell&apos;anno, così ogni periodo accantona la sua parte. I contributi in realtà si
            deducono nell&apos;anno in cui li paghi: la stima serve per decidere quanto mettere da parte, non per la dichiarazione. Verifica sempre con il commercialista.
          </p>
            </>
          )}
        </aside>
      </div>
      <div className="settings-grid">
        <CategoryManager categories={planning.categories} rules={planning.rules} regime={settings.regime ?? "forfettario"} />
      </div>
    </div>
  );
}
