"use client";

import { Briefcase, Check, Home, Minus, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/app/actions";
import {
  deleteBudget,
  deleteGoal,
  deleteRecurring,
  moveGoal,
  payRecurring,
  saveBudget,
  saveGoal,
  saveRecurring,
  toggleRecurring,
} from "@/app/planning-actions";
import { formatEur, todayRome, type Kind } from "@/lib/finance";
import { IVA_RATES, type Regime } from "@/lib/ordinario";
import {
  categoriesFor,
  dueStatus,
  FREQUENCIES,
  monthlyEquivalent,
  SCOPE_LABEL,
  type BudgetStatus,
  type CustomCategory,
  type GoalStatus,
  type Recurring,
  type Scope,
} from "@/lib/planning";
import { BudgetMeter } from "./PlanningCards";

const dateIt = (iso: string) => iso.split("-").reverse().join("/");
const toInput = (n: number) => n.toFixed(2).replace(".", ",");
const pct = (n: number) => `${Math.round(n * 100)}%`;

function ScopeSwitch({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="seg seg-full" role="radiogroup" aria-label="Ambito">
      {(["work", "life"] as Scope[]).map((s) => (
        <label key={s} className={scope === s ? "active" : ""}>
          <input type="radio" checked={scope === s} onChange={() => onChange(s)} />
          {s === "work" ? <Briefcase size={15} /> : <Home size={15} />} {SCOPE_LABEL[s]}
        </label>
      ))}
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={`alert ${state.ok ? "alert-ok" : "alert-error"}`}>{state.message}</p>;
}

/** Riquadro "Aggiungi" che si chiude da solo dopo un salvataggio riuscito. */
function AddBox({ label, children, state }: { label: string; children: React.ReactNode; state: ActionState }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (state.ok && ref.current) ref.current.open = false;
  }, [state]);
  return (
    <details ref={ref} className="card add-box">
      <summary className="btn btn-secondary btn-sm">
        <Plus size={16} /> {label}
      </summary>
      {children}
    </details>
  );
}

// ─── Budget ────────────────────────────────────────────────────

export function BudgetSection({ budgets, categories }: { budgets: BudgetStatus[]; categories: CustomCategory[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveBudget, {});
  const [scope, setScope] = useState<Scope>("life");
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [editState, editAction] = useActionState<ActionState, FormData>(saveBudget, {});
  useEffect(() => {
    if (editState.ok) setEditing(null);
  }, [editState]);

  return (
    <div className="stack">
      {budgets.length > 0 && (
        <div className="card plan-list">
          {budgets.map((b) => (
            <div key={b.id} className="plan-item">
              <span className="plan-title">
                <span className={`scope-chip ${b.scope}`}>{SCOPE_LABEL[b.scope]}</span>
                <span>{b.category}</span>
              </span>
              <span className="plan-actions">
                <span className={`status-pill ${b.level}`}>{b.level === "ok" ? pct(b.ratio) : b.level === "attenzione" ? `${pct(b.ratio)} · attenzione` : "superato"}</span>
                <button className="btn btn-ghost btn-icon" aria-label={`Modifica ${b.category}`} onClick={() => setEditing(editing === b.id ? null : b.id)}>
                  <Pencil size={15} />
                </button>
                <button
                  className="btn btn-ghost btn-icon"
                  aria-label={`Elimina budget ${b.category}`}
                  disabled={busy}
                  onClick={() => confirm(`Eliminare il budget per ${b.category}?`) && start(() => deleteBudget(b.id))}
                >
                  <Trash2 size={15} />
                </button>
              </span>
              <BudgetMeter b={b} />
              <span className="plan-meta" style={{ gridColumn: "1 / -1" }}>
                {formatEur(b.spent)} spesi su {formatEur(b.monthly_limit)} ·{" "}
                {b.remaining >= 0 ? `restano ${formatEur(b.remaining)}` : `${formatEur(-b.remaining)} oltre il tetto`}
              </span>
              {editing === b.id && (
                <form action={editAction} className="inline-form" style={{ gridColumn: "1 / -1" }}>
                  <input type="hidden" name="scope" value={b.scope} />
                  <input type="hidden" name="category" value={b.category} />
                  <input name="monthly_limit" inputMode="decimal" defaultValue={toInput(b.monthly_limit)} aria-label="Nuovo tetto mensile" />
                  <button className="btn btn-primary btn-sm">
                    <Check size={15} /> Salva
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
      <AddBox label="Nuovo budget" state={state}>
        <form action={action} className="stack">
          <input type="hidden" name="scope" value={scope} />
          <ScopeSwitch scope={scope} onChange={setScope} />
          <div className="form-grid">
            <label className="field">
              <span>Categoria</span>
              <select name="category" key={scope}>
                {categoriesFor(scope, "uscita", categories).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tetto mensile</span>
              <div className="input-affix">
                <input name="monthly_limit" inputMode="decimal" placeholder="300" required />
                <span>€</span>
              </div>
            </label>
          </div>
          <p className="small muted">Ti avviso all&apos;80% del tetto e quando lo superi.</p>
          <Feedback state={state} />
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Salvataggio…" : "Salva budget"}
          </button>
        </form>
      </AddBox>
    </div>
  );
}

// ─── Spese ricorrenti ──────────────────────────────────────────

function RecurringForm({ initial, categories, regime, onDone }: { initial?: Recurring; categories: CustomCategory[]; regime: Regime; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRecurring, {});
  const [scope, setScope] = useState<Scope>(initial?.scope ?? "life");
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "uscita");
  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);
  const cats = categoriesFor(scope, kind, categories);
  return (
    <form action={action} className="stack">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="kind" value={kind} />
      <div className="form-grid toggles">
        <ScopeSwitch scope={scope} onChange={setScope} />
        <div className="seg seg-full" role="radiogroup" aria-label="Tipo">
          {(["uscita", "entrata"] as Kind[]).map((k) => (
            <label key={k} className={kind === k ? "active" : ""}>
              <input type="radio" checked={kind === k} onChange={() => setKind(k)} />
              {k === "uscita" ? "Pagamento" : "Incasso"}
            </label>
          ))}
        </div>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Nome</span>
          <input name="name" defaultValue={initial?.name} placeholder="Affitto, Netflix, Enel…" required maxLength={80} />
        </label>
        <label className="field">
          <span>Importo</span>
          <div className="input-affix">
            <input name="amount" inputMode="decimal" defaultValue={initial ? toInput(initial.amount) : ""} placeholder="0,00" required />
            <span>€</span>
          </div>
        </label>
      </div>
      <div className="form-grid-3">
        <label className="field">
          <span>Ogni</span>
          <select name="frequency" defaultValue={initial?.frequency ?? "mensile"}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Prossima scadenza</span>
          <input type="date" name="next_date" defaultValue={initial?.next_date ?? todayRome()} required />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select name="category" key={`${scope}-${kind}`} defaultValue={initial && cats.includes(initial.category) ? initial.category : cats[0]}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {regime === "ordinario" && scope === "work" && (
        <label className="field">
          <span>IVA</span>
          <select name="iva" defaultValue={String(initial?.iva ?? 22)}>
            {IVA_RATES.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? "Esente" : `${r}%`}
              </option>
            ))}
          </select>
        </label>
      )}
      <Feedback state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Salvataggio…" : initial ? "Salva modifiche" : "Aggiungi"}
      </button>
    </form>
  );
}

export function RecurringSection({ recurring, categories, regime, today }: { recurring: Recurring[]; categories: CustomCategory[]; regime: Regime; today: string }) {
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionState>({});
  const [addKey, setAddKey] = useState(0);
  const addState: ActionState = { ok: addKey > 0 };

  return (
    <div className="stack">
      {message.message && <Feedback state={message} />}
      {recurring.length > 0 && (
        <div className="card plan-list">
          {recurring.map((r) => {
            const s = r.active ? dueStatus(r.next_date, today) : null;
            return (
              <div key={r.id} className="plan-item" style={{ opacity: r.active ? 1 : 0.55 }}>
                <span className="plan-title">
                  <span className={`scope-chip ${r.scope}`}>{SCOPE_LABEL[r.scope]}</span>
                  <span>{r.name}</span>
                </span>
                <span className="small num">
                  <strong>
                    {r.kind === "entrata" ? "+" : "−"}
                    {formatEur(r.amount)}
                  </strong>
                </span>
                <span className="plan-meta">
                  {r.frequency} · {r.category} · ≈ {formatEur(monthlyEquivalent(r.amount, r.frequency))} al mese
                  <br />
                  Prossima: {dateIt(r.next_date)}{" "}
                  {s && s !== "futura" && <span className={`status-pill ${s}`}>{s === "scaduta" ? "scaduta" : s === "oggi" ? "oggi" : "a breve"}</span>}
                  {!r.active && <span className="status-pill pausa">in pausa</span>}
                </span>
                <span className="plan-actions">
                  {r.active && (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => start(async () => setMessage(await payRecurring(r.id)))}
                      title="Crea il movimento e passa alla scadenza successiva"
                    >
                      <Check size={15} /> {r.kind === "entrata" ? "Incassata" : "Pagata"}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-icon" aria-label={r.active ? "Metti in pausa" : "Riattiva"} disabled={busy} onClick={() => start(() => toggleRecurring(r.id, !r.active))}>
                    {r.active ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button className="btn btn-ghost btn-icon" aria-label={`Modifica ${r.name}`} onClick={() => setEditing(editing === r.id ? null : r.id)}>
                    <Pencil size={15} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    aria-label={`Elimina ${r.name}`}
                    disabled={busy}
                    onClick={() => confirm(`Eliminare ${r.name}?`) && start(() => deleteRecurring(r.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
                {editing === r.id && (
                  <div style={{ gridColumn: "1 / -1", paddingTop: 8 }}>
                    <RecurringForm initial={r} categories={categories} regime={regime} onDone={() => setEditing(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <AddBox label="Nuova spesa ricorrente" state={addState}>
        <RecurringForm key={addKey} categories={categories} regime={regime} onDone={() => setAddKey((k) => k + 1)} />
      </AddBox>
    </div>
  );
}

// ─── Obiettivi ─────────────────────────────────────────────────

function GoalMoves({ g }: { g: GoalStatus }) {
  const [amount, setAmount] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>({});
  const value = Number(amount.includes(",") ? amount.replace(/\./g, "").replace(",", ".") : amount);
  const move = (sign: 1 | -1) =>
    start(async () => {
      const r = await moveGoal(g.id, sign * value);
      setMsg(r);
      if (r.ok) setAmount("");
    });
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="inline-form">
        <input inputMode="decimal" placeholder="Importo" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Importo per ${g.name}`} />
        <button className="btn btn-primary btn-sm" disabled={busy || !(value > 0)} onClick={() => move(1)} aria-label="Aggiungi">
          <Plus size={15} />
        </button>
        <button className="btn btn-secondary btn-sm" disabled={busy || !(value > 0)} onClick={() => move(-1)} aria-label="Preleva">
          <Minus size={15} />
        </button>
      </div>
      {msg.message && !msg.ok && <p className="alert alert-error small">{msg.message}</p>}
    </div>
  );
}

export function GoalsSection({ goals, taxYtd }: { goals: GoalStatus[]; taxYtd: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveGoal, {});
  const [busy, start] = useTransition();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  return (
    <div className="stack">
      {goals.length > 0 && (
        <div className="goal-grid">
          {goals.map((g) => (
            <div key={g.id} className="card goal kcard kind-profit">
              <div className="row between">
                <strong>{g.name}</strong>
                <button
                  className="btn btn-ghost btn-icon"
                  aria-label={`Elimina ${g.name}`}
                  disabled={busy}
                  onClick={() => confirm(`Eliminare l'obiettivo ${g.name}?`) && start(() => deleteGoal(g.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div>
                <span className="goal-value">{formatEur(g.saved)}</span> <span className="muted">di {formatEur(g.target)}</span>
              </div>
              <div className="meter" aria-hidden>
                <i style={{ width: `${g.progress * 100}%`, background: "var(--c-profit)" }} />
              </div>
              <span className="plan-meta">
                {g.missing === 0
                  ? "Obiettivo raggiunto"
                  : `Mancano ${formatEur(g.missing)}${g.deadline ? ` · entro il ${dateIt(g.deadline)}` : ""}${g.perMonth ? ` · ${formatEur(g.perMonth)} al mese` : ""}`}
                {g.late && <span className="status-pill scaduta" style={{ marginLeft: 6 }}>scaduto</span>}
              </span>
              <GoalMoves g={g} />
            </div>
          ))}
        </div>
      )}
      <AddBox label="Nuovo obiettivo" state={state}>
        <form action={action} className="stack">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="small muted">Idee:</span>
            {[
              ["Fondo emergenza", ""],
              ["Tasse dell'anno", taxYtd > 0 ? toInput(taxYtd) : ""],
              ["Nuovo computer", "1500"],
              ["Vacanza", ""],
            ].map(([n, t]) => (
              <button
                key={n}
                type="button"
                className="badge badge-muted"
                style={{ border: 0, cursor: "pointer" }}
                onClick={() => {
                  setName(n);
                  if (t) setTarget(t);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Nome</span>
              <input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fondo emergenza" required maxLength={80} />
            </label>
            <label className="field">
              <span>Traguardo</span>
              <div className="input-affix">
                <input name="target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="6000" required />
                <span>€</span>
              </div>
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Già messo da parte</span>
              <div className="input-affix">
                <input name="saved" inputMode="decimal" placeholder="0" />
                <span>€</span>
              </div>
            </label>
            <label className="field">
              <span>Entro il (facoltativo)</span>
              <input type="date" name="deadline" />
            </label>
          </div>
          <Feedback state={state} />
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Salvataggio…" : "Crea obiettivo"}
          </button>
        </form>
      </AddBox>
    </div>
  );
}
