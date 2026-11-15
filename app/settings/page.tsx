import { SettingsForm } from "@/components/SettingsForm";
import { fetchSettings } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const settings = await fetchSettings(supabase);
  return (
    <div className="stack-lg narrow">
      <h1>Impostazioni</h1>
      <div className="card">
        <h2>Parametri del regime forfettario</h2>
        <SettingsForm settings={settings} />
      </div>
      <div className="card muted small">
        <p>
          <strong>Come si calcola la stima.</strong> Imponibile = incassi × coefficiente. Contributi = imponibile × aliquota INPS.
          Imposta sostitutiva = (imponibile − contributi) × aliquota. Nel forfettario le spese non riducono le tasse.
        </p>
        <p>
          I contributi nella realtà si deducono nell&apos;anno in cui vengono pagati, e artigiani e commercianti hanno anche contributi
          fissi: la stima serve per decidere quanto accantonare, non per la dichiarazione. Verifica sempre con il commercialista.
        </p>
      </div>
    </div>
  );
}
