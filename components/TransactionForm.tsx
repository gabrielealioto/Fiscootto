"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTransaction, type ActionState } from "@/app/actions";
import { CATEGORIES, type Kind } from "@/lib/finance";

export function TransactionForm({ defaultDate }: { defaultDate: string }) {
  const [kind, setKind] = useState<Kind>("entrata");
  const [state, action, pending] = useActionState<ActionState, FormData>(addTransaction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      const f = formRef.current;
      if (f) {
        (f.elements.namedItem("amount") as HTMLInputElement).value = "";
        (f.elements.namedItem("description") as HTMLInputElement).value = "";
        (f.elements.namedItem("amount") as HTMLInputElement).focus();
      }
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="stack">
      <div className="segmented segmented-full">
        {(["entrata", "uscita"] as Kind[]).map((k) => (
          <label key={k} className={kind === k ? "active" : ""}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            {k === "entrata" ? "Entrata" : "Uscita"}
          </label>
        ))}
      </div>
      <div className="row">
        <label className="field">
          <span>Data</span>
          <input type="date" name="date" defaultValue={defaultDate} required />
        </label>
        <label className="field">
          <span>Importo (€)</span>
          <input name="amount" inputMode="decimal" placeholder="0,00" required autoComplete="off" />
        </label>
      </div>
      <label className="field">
        <span>Categoria</span>
        <select name="category" key={kind} defaultValue={CATEGORIES[kind][0]}>
          {CATEGORIES[kind].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Descrizione</span>
        <input name="description" maxLength={300} placeholder={kind === "entrata" ? "Fattura n. 12 – Cliente" : "Abbonamento software"} />
      </label>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Salvataggio…" : "Aggiungi"}
      </button>
      {state.message && <p className={`alert ${state.ok ? "alert-ok" : "alert-error"}`}>{state.message}</p>}
    </form>
  );
}
