"use client";

import { useActionState } from "react";
import { saveSettings, type ActionState } from "@/app/actions";
import type { TaxSettings } from "@/lib/finance";

const toPct = (n: number) => String(Math.round(n * 10000) / 100).replace(".", ",");

export function SettingsForm({ settings }: { settings: TaxSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, {});
  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Coefficiente di redditività (%)</span>
        <input name="coefficiente" inputMode="decimal" defaultValue={toPct(settings.coefficiente)} required />
        <small className="muted">Dipende dal codice ATECO: 78% per molte attività professionali, 67% per altre, 40% per il commercio.</small>
      </label>
      <label className="field">
        <span>Aliquota contributi INPS (%)</span>
        <input name="aliquota_contributi" inputMode="decimal" defaultValue={toPct(settings.aliquota_contributi)} required />
        <small className="muted">Gestione separata: 26,07%. Per la cassa professionale usa la sua aliquota.</small>
      </label>
      <label className="field">
        <span>Imposta sostitutiva (%)</span>
        <input name="aliquota_imposta" inputMode="decimal" defaultValue={toPct(settings.aliquota_imposta)} required />
        <small className="muted">15% ordinaria, 5% per i primi cinque anni di una nuova attività (se hai i requisiti).</small>
      </label>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Salvataggio…" : "Salva"}
      </button>
      {state.message && <p className={`alert ${state.ok ? "alert-ok" : "alert-error"}`}>{state.message}</p>}
    </form>
  );
}
