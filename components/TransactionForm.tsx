"use client";

import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { addTransaction, type ActionState } from "@/app/actions";
import { CATEGORIES, formatEur, todayRome, type Kind } from "@/lib/finance";
import { costRule, incomeIva, IVA_RATES, splitIva, type Regime } from "@/lib/ordinario";

export function TransactionForm({ onDone, regime = "forfettario" }: { onDone?: () => void; regime?: Regime }) {
  const [kind, setKind] = useState<Kind>("entrata");
  const [category, setCategory] = useState(CATEGORIES.entrata[0]);
  const [amount, setAmount] = useState("");
  const ordinario = regime === "ordinario";
  const ivaFor = (k: Kind, c: string) => (k === "entrata" ? incomeIva(c) : costRule(c).ivaPredefinita);
  const [iva, setIva] = useState<number>(ivaFor("entrata", CATEGORIES.entrata[0]));

  function chooseKind(k: Kind) {
    setKind(k);
    setCategory(CATEGORIES[k][0]);
    setIva(ivaFor(k, CATEGORIES[k][0]));
  }
  function chooseCategory(c: string) {
    setCategory(c);
    setIva(ivaFor(kind, c));
  }
  const lordo = Number(amount.includes(",") ? amount.replace(/\./g, "").replace(",", ".") : amount);
  const parts = Number.isFinite(lordo) && lordo > 0 ? splitIva(lordo, iva) : null;
  const rule = costRule(category);
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
          <input type="radio" name="kind" value="entrata" checked={kind === "entrata"} onChange={() => chooseKind("entrata")} />
          <ArrowDownLeft size={17} style={{ color: "var(--k)" }} /> Entrata
        </label>
        <label className={`kind-out ${kind === "uscita" ? "active" : ""}`}>
          <input type="radio" name="kind" value="uscita" checked={kind === "uscita"} onChange={() => chooseKind("uscita")} />
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
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
          <select name="category" value={category} onChange={(e) => chooseCategory(e.target.value)}>
            {CATEGORIES[kind].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {ordinario && (
        <div className="field">
          <span>IVA {kind === "entrata" ? "in fattura" : "pagata"}</span>
          <div className="seg seg-full" role="radiogroup" aria-label="Aliquota IVA">
            {IVA_RATES.map((r) => (
              <label key={r} className={iva === r ? "active" : ""}>
                <input type="radio" name="iva" value={r} checked={iva === r} onChange={() => setIva(r)} />
                {r === 0 ? "Esente" : `${r}%`}
              </label>
            ))}
          </div>
          <small>
            {parts && iva > 0
              ? `Imponibile ${formatEur(parts.netto)} + IVA ${formatEur(parts.iva)}. Inserisci l'importo totale, IVA compresa.`
              : "Inserisci l'importo totale, IVA compresa."}
          </small>
        </div>
      )}

      {ordinario && kind === "uscita" && (
        <p className="alert alert-info small">
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {rule.deducibile > 0 ? `Deducibile al ${Math.round(rule.deducibile * 100)}%` : "Non deducibile"}
            {rule.ivaDetraibile > 0 && rule.ivaDetraibile < 1 ? `, IVA detraibile al ${Math.round(rule.ivaDetraibile * 100)}%` : ""}
            {rule.nota ? `. ${rule.nota}` : "."}
          </span>
        </p>
      )}

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
