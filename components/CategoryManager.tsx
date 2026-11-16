"use client";

import { ArrowRight, Briefcase, Home, Plus, Tags, Trash2, Wand2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import type { ActionState } from "@/app/actions";
import { deleteCategory, deleteRule, saveCategory, saveRule } from "@/app/planning-actions";
import type { Kind } from "@/lib/finance";
import { categoriesFor, SCOPE_LABEL, type CategoryRule, type CustomCategory, type Scope } from "@/lib/planning";

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string, React.ReactNode?][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg seg-full" role="radiogroup" aria-label={label}>
      {options.map(([v, text, icon]) => (
        <label key={v} className={value === v ? "active" : ""}>
          <input type="radio" checked={value === v} onChange={() => onChange(v)} />
          {icon} {text}
        </label>
      ))}
    </div>
  );
}

const SCOPE_OPTIONS: [Scope, string, React.ReactNode][] = [
  ["work", "Work", <Briefcase key="w" size={15} />],
  ["life", "Life", <Home key="l" size={15} />],
];
const KIND_OPTIONS: [Kind, string][] = [
  ["uscita", "Uscita"],
  ["entrata", "Entrata"],
];

export function CategoryManager({ categories, rules, regime }: { categories: CustomCategory[]; rules: CategoryRule[]; regime: string }) {
  const [busy, start] = useTransition();
  const [catState, catAction, catPending] = useActionState<ActionState, FormData>(saveCategory, {});
  const [ruleState, ruleAction, rulePending] = useActionState<ActionState, FormData>(saveRule, {});
  const [cScope, setCScope] = useState<Scope>("life");
  const [cKind, setCKind] = useState<Kind>("uscita");
  const [rScope, setRScope] = useState<Scope>("life");
  const [rKind, setRKind] = useState<Kind>("uscita");

  return (
    <div className="stack-lg">
      <section className="card stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="card-icon">
            <Tags size={19} />
          </span>
          <div>
            <h2>Le tue categorie</h2>
            <p className="small muted">Si aggiungono a quelle predefinite di Work e Life.</p>
          </div>
        </div>
        {categories.length > 0 && (
          <div className="plan-list">
            {categories.map((c) => (
              <div key={c.id} className="plan-item">
                <span className="plan-title">
                  <span className={`scope-chip ${c.scope}`}>{SCOPE_LABEL[c.scope]}</span>
                  <span>{c.name}</span>
                </span>
                <span className="plan-actions">
                  <span className="small muted">
                    {c.kind === "uscita" ? "uscita" : "entrata"}
                    {regime === "ordinario" && c.scope === "work" && c.kind === "uscita" ? ` · deducibile ${Math.round(c.deducibile * 100)}%` : ""}
                  </span>
                  <button
                    className="btn btn-ghost btn-icon"
                    aria-label={`Elimina ${c.name}`}
                    disabled={busy}
                    onClick={() => confirm(`Eliminare la categoria ${c.name}? I movimenti già registrati la mantengono.`) && start(() => deleteCategory(c.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <form action={catAction} className="stack">
          <input type="hidden" name="scope" value={cScope} />
          <input type="hidden" name="kind" value={cKind} />
          <div className="form-grid toggles">
            <Toggle value={cScope} options={SCOPE_OPTIONS} onChange={setCScope} label="Ambito" />
            <Toggle value={cKind} options={KIND_OPTIONS} onChange={setCKind} label="Tipo" />
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Nome</span>
              <input name="name" placeholder={cScope === "life" ? "Palestra" : "Coworking"} required maxLength={60} />
            </label>
            {regime === "ordinario" && cScope === "work" && cKind === "uscita" ? (
              <label className="field">
                <span>Quota deducibile</span>
                <div className="input-affix">
                  <input name="deducibile" inputMode="decimal" defaultValue="100" />
                  <span>%</span>
                </div>
              </label>
            ) : (
              <div />
            )}
          </div>
          {catState.message && <p className={`alert ${catState.ok ? "alert-ok" : "alert-error"}`}>{catState.message}</p>}
          <button className="btn btn-secondary" disabled={catPending}>
            <Plus size={16} /> Aggiungi categoria
          </button>
        </form>
      </section>

      <section className="card stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="card-icon">
            <Wand2 size={19} />
          </span>
          <div>
            <h2>Regole automatiche</h2>
            <p className="small muted">Se la descrizione contiene un testo, scelgo io ambito e categoria (import CSV e inserimento).</p>
          </div>
        </div>
        {rules.length > 0 && (
          <div className="plan-list">
            {rules.map((r) => (
              <div key={r.id} className="plan-item">
                <span className="plan-title" style={{ gap: 6 }}>
                  <code>{r.pattern}</code>
                  <ArrowRight size={14} className="subtle" />
                  <span className={`scope-chip ${r.scope}`}>{SCOPE_LABEL[r.scope]}</span>
                  <span>{r.category}</span>
                </span>
                <span className="plan-actions">
                  <span className="small muted">{r.kind}</span>
                  <button
                    className="btn btn-ghost btn-icon"
                    aria-label={`Elimina regola ${r.pattern}`}
                    disabled={busy}
                    onClick={() => start(() => deleteRule(r.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <form action={ruleAction} className="stack">
          <input type="hidden" name="scope" value={rScope} />
          <input type="hidden" name="kind" value={rKind} />
          <div className="form-grid toggles">
            <Toggle value={rScope} options={SCOPE_OPTIONS} onChange={setRScope} label="Ambito" />
            <Toggle value={rKind} options={KIND_OPTIONS} onChange={setRKind} label="Tipo" />
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Se la descrizione contiene</span>
              <input name="pattern" placeholder="Enel, Esselunga, Amazon…" required minLength={2} maxLength={80} />
            </label>
            <label className="field">
              <span>Categoria</span>
              <select name="category" key={`${rScope}-${rKind}`}>
                {categoriesFor(rScope, rKind, categories).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          {ruleState.message && <p className={`alert ${ruleState.ok ? "alert-ok" : "alert-error"}`}>{ruleState.message}</p>}
          <button className="btn btn-secondary" disabled={rulePending}>
            <Plus size={16} /> Aggiungi regola
          </button>
        </form>
      </section>
    </div>
  );
}
