"use client";

import { Briefcase, Check, Info } from "lucide-react";
import { useActionState, useState } from "react";
import { saveSettings, type ActionState } from "@/app/actions";
import { lookupAteco } from "@/lib/ateco";
import type { TaxSettings } from "@/lib/finance";

const toPct = (n: number) => String(Math.round(n * 10000) / 100).replace(".", ",");
const pctLabel = (n: number) => `${toPct(n)}%`;

export function SettingsForm({ settings, ateco: initialAteco }: { settings: TaxSettings; ateco: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, {});
  const [ateco, setAteco] = useState(initialAteco);
  const [coeff, setCoeff] = useState(toPct(settings.coefficiente));
  const [imposta, setImposta] = useState(toPct(settings.aliquota_imposta));

  const result = ateco.trim() ? lookupAteco(ateco) : null;

  function onAteco(value: string) {
    setAteco(value);
    const r = value.trim() ? lookupAteco(value) : null;
    if (r?.status === "ok") setCoeff(toPct(r.group.coefficiente));
  }

  return (
    <form action={action} className="stack-lg">
      <section className="card stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="card-icon">
            <Briefcase size={19} />
          </span>
          <div>
            <h2>La tua attività</h2>
            <p className="small muted">Dal codice ATECO ricavo il coefficiente di redditività.</p>
          </div>
        </div>

        <label className="field">
          <span>Codice ATECO</span>
          <input
            name="ateco"
            value={ateco}
            onChange={(e) => onAteco(e.target.value)}
            placeholder="es. 62.01.00"
            inputMode="decimal"
            autoComplete="off"
            maxLength={10}
          />
          <small>Lo trovi nel certificato di attribuzione della partita IVA o nel cassetto fiscale.</small>
        </label>

        {result?.status === "invalid" && <p className="alert alert-warn">{result.message}</p>}

        {result?.status === "ok" && (
          <div className="ateco-result">
            <span className="small muted">Gruppo del forfettario</span>
            <span style={{ fontWeight: 600 }}>{result.group.label}</span>
            <span className="row" style={{ gap: 8 }}>
              <strong>{pctLabel(result.group.coefficiente)}</strong>
              <span className="badge">
                <Check size={12} /> coefficiente applicato
              </span>
            </span>
            {result.note && (
              <span className="small muted row" style={{ alignItems: "flex-start", gap: 6 }}>
                <Info size={14} style={{ marginTop: 3 }} /> {result.note}
              </span>
            )}
          </div>
        )}

        {result?.status === "choose" && (
          <div className="ateco-result">
            <span className="small muted">Questo codice può ricadere in più gruppi: scegli quello giusto.</span>
            <div className="option-list">
              {result.options.map((o) => {
                const selected = coeff === toPct(o.coefficiente);
                return (
                  <button
                    type="button"
                    key={o.id}
                    className={`option ${selected ? "selected" : ""}`}
                    onClick={() => setCoeff(toPct(o.coefficiente))}
                  >
                    <span>{o.label}</span>
                    <strong style={{ fontSize: "0.95rem" }}>{pctLabel(o.coefficiente)}</strong>
                  </button>
                );
              })}
            </div>
            <span className="small muted row" style={{ alignItems: "flex-start", gap: 6 }}>
              <Info size={14} style={{ marginTop: 3 }} /> {result.note}
            </span>
          </div>
        )}
      </section>

      <section className="card stack" style={{ gap: 16 }}>
        <div>
          <h2>Parametri fiscali</h2>
          <p className="small muted">Usati per stimare contributi e imposta da accantonare.</p>
        </div>
        <label className="field">
          <span>Coefficiente di redditività</span>
          <div className="input-affix">
            <input name="coefficiente" inputMode="decimal" value={coeff} onChange={(e) => setCoeff(e.target.value)} required />
            <span>%</span>
          </div>
          <small>Impostato dal codice ATECO; puoi comunque modificarlo.</small>
        </label>
        <label className="field">
          <span>Aliquota contributi INPS</span>
          <div className="input-affix">
            <input name="aliquota_contributi" inputMode="decimal" defaultValue={toPct(settings.aliquota_contributi)} required />
            <span>%</span>
          </div>
          <small>Gestione separata: 26,07%. Se hai una cassa professionale, usa la sua aliquota.</small>
        </label>
        <div className="field">
          <span>Imposta sostitutiva</span>
          <div className="seg seg-full" role="radiogroup" aria-label="Imposta sostitutiva">
            {[
              ["15", "15% · ordinaria"],
              ["5", "5% · nuova attività"],
            ].map(([v, l]) => (
              <label key={v} className={imposta === v ? "active" : ""}>
                <input type="radio" checked={imposta === v} onChange={() => setImposta(v)} />
                {l}
              </label>
            ))}
          </div>
          <input type="hidden" name="aliquota_imposta" value={imposta} />
          <small>Il 5% vale per i primi cinque anni di una nuova attività, se hai i requisiti.</small>
        </div>
      </section>

      {state.message && <p className={`alert ${state.ok ? "alert-ok" : "alert-error"}`}>{state.message}</p>}
      <button className="btn btn-primary btn-block" disabled={pending} style={{ padding: "14px 16px" }}>
        {pending ? "Salvataggio…" : "Salva impostazioni"}
      </button>
    </form>
  );
}
