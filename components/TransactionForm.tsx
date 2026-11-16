"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { addTransaction, type ActionState } from "@/app/actions";
import { CATEGORIES, todayRome, type Kind } from "@/lib/finance";

export function TransactionForm({ onDone }: { onDone?: () => void }) {
  const [kind, setKind] = useState<Kind>("entrata");
  const [state, action, pending] = useActionState<ActionState, FormData>(addTransaction, {});
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <div className="seg seg-full" role="radiogroup" aria-label="Tipo di movimento">
        <label className={`kind-in ${kind === "entrata" ? "active" : ""}`}>
          <input type="radio" name="kind" value="entrata" checked={kind === "entrata"} onChange={() => setKind("entrata")} />
          <ArrowDownLeft size={17} style={{ color: "var(--k)" }} /> Entrata
        </label>
        <label className={`kind-out ${kind === "uscita" ? "active" : ""}`}>
          <input type="radio" name="kind" value="uscita" checked={kind === "uscita"} onChange={() => setKind("uscita")} />
          <ArrowUpRight size={17} style={{ color: "var(--k)" }} /> Uscita
        </label>
      </div>

      <label className="field">
        <span>Importo</span>
        <div className="input-affix">
          <input
            ref={amountRef}
            name="amount"
            className="input-lg"
            inputMode="decimal"
            placeholder="0,00"
            required
            autoComplete="off"
          />
          <span>€</span>
        </div>
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Data</span>
          <input type="date" name="date" defaultValue={todayRome()} required />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select name="category" key={kind} defaultValue={CATEGORIES[kind][0]}>
            {CATEGORIES[kind].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Descrizione</span>
        <input name="description" maxLength={300} placeholder={kind === "entrata" ? "Fattura n. 12 – Rossi Srl" : "Abbonamento Figma"} />
      </label>

      {state.message && !state.ok && <p className="alert alert-error">{state.message}</p>}

      <button className="btn btn-primary btn-block" disabled={pending} style={{ padding: "14px 16px" }}>
        {pending ? "Salvataggio…" : kind === "entrata" ? "Aggiungi entrata" : "Aggiungi uscita"}
      </button>
    </form>
  );
}
