"use client";

import { ArrowDownLeft, ArrowUpRight, Briefcase, Camera, Home, Info, LoaderCircle, Wand2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { addTransaction, updateTransaction, type ActionState } from "@/app/actions";
import { formatEur, todayRome, type Kind, type Transaction } from "@/lib/finance";
import { costRule, customRule, incomeIva, IVA_RATES, splitIva, type Regime } from "@/lib/ordinario";
import { categoriesFor, matchRule, type CategoryRule, type CustomCategory, type Scope } from "@/lib/planning";

export interface FormContext {
  regime: Regime;
  aiEnabled: boolean;
  categories: CustomCategory[];
  rules: CategoryRule[];
}

interface Props extends FormContext {
  onDone?: () => void;
  initial?: Transaction;
  startWithReceipt?: boolean;
}

/** Riduce la foto (max 1600 px, JPEG) prima di inviarla: più veloce e meno costosa da leggere. */
async function compressImage(file: File): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}

const toInput = (n: number) => n.toFixed(2).replace(".", ",");

export function TransactionForm({ onDone, initial, startWithReceipt, regime, aiEnabled, categories, rules }: Props) {
  const editing = !!initial;
  const [scope, setScope] = useState<Scope>(initial?.scope ?? "work");
  const [kind, setKind] = useState<Kind>(initial?.kind ?? (startWithReceipt ? "uscita" : "entrata"));
  const options = (s: Scope, k: Kind) => categoriesFor(s, k, categories);
  const [category, setCategory] = useState(initial?.category ?? options(scope, kind)[0]);
  const [categoryTouched, setCategoryTouched] = useState(editing);
  const [amount, setAmount] = useState(initial ? toInput(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? todayRome());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ruleHint, setRuleHint] = useState("");
  const [receipt, setReceipt] = useState<{ status: "idle" | "reading" | "done" | "error"; message?: string }>({ status: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const ivaFor = (s: Scope, k: Kind, c: string) => (s === "life" ? 0 : k === "entrata" ? incomeIva(c) : ruleFor(c).ivaPredefinita);
  const ruleFor = (c: string) => {
    const custom = categories.find((x) => x.scope === "work" && x.kind === "uscita" && x.name === c);
    return custom ? customRule(custom.deducibile) : costRule(c);
  };
  const [iva, setIva] = useState<number>(initial?.iva ?? ivaFor(scope, kind, category));

  const [state, action, pending] = useActionState<ActionState, FormData>(editing ? updateTransaction : addTransaction, {});
  const amountRef = useRef<HTMLInputElement>(null);
  const showIva = regime === "ordinario" && scope === "work";

  useEffect(() => {
    if (startWithReceipt) fileRef.current?.click();
    else if (!editing) amountRef.current?.focus();
  }, [startWithReceipt, editing]);

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  function choose(s: Scope, k: Kind, c?: string) {
    const list = options(s, k);
    const next = c && list.includes(c) ? c : list.includes(category) && s === scope ? category : list[0];
    setScope(s);
    setKind(k);
    setCategory(next);
    setIva(ivaFor(s, k, next));
  }

  // Le regole automatiche propongono ambito e categoria mentre si scrive la descrizione.
  function onDescription(v: string) {
    setDescription(v);
    if (categoryTouched) return;
    const r = matchRule(v, kind, rules);
    if (r) {
      choose(r.scope, kind, r.category);
      setRuleHint(`Categoria scelta dalla regola "${r.pattern}".`);
    } else setRuleHint("");
  }

  async function readReceipt(file: File | undefined) {
    if (!file) return;
    setReceipt({ status: "reading" });
    try {
      const img = await compressImage(file);
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: img.data, mediaType: img.mediaType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
      const r = data.receipt as {
        date: string | null;
        total: number | null;
        merchant: string;
        description: string;
        scope: Scope;
        category: string;
        iva: number;
        confidence: string;
      };
      if (r.total) setAmount(toInput(r.total));
      if (r.date) setDate(r.date);
      setDescription([r.merchant, r.description].filter(Boolean).join(" – ").slice(0, 300));
      const list = options(r.scope, "uscita");
      const cat = list.includes(r.category) ? r.category : list[0];
      setScope(r.scope);
      setKind("uscita");
      setCategory(cat);
      setCategoryTouched(true);
      setIva(r.scope === "work" ? r.iva : 0);
      setReceipt({
        status: "done",
        message:
          r.confidence === "alta"
            ? "Scontrino letto: controlla i dati e salva."
            : "Scontrino letto in parte: controlla bene importo e data prima di salvare.",
      });
    } catch (e) {
      setReceipt({ status: "error", message: (e as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const lordo = Number(amount.includes(",") ? amount.replace(/\./g, "").replace(",", ".") : amount);
  const parts = Number.isFinite(lordo) && lordo > 0 ? splitIva(lordo, iva) : null;
  const rule = ruleFor(category);

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      {editing && <input type="hidden" name="id" value={initial!.id} />}
      <input type="hidden" name="scope" value={scope} />

      {aiEnabled && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => readReceipt(e.target.files?.[0])} />
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => fileRef.current?.click()}
            disabled={receipt.status === "reading"}
          >
            {receipt.status === "reading" ? <LoaderCircle size={17} className="spin" /> : <Camera size={17} />}
            {receipt.status === "reading" ? "Sto leggendo lo scontrino…" : "Leggi da foto dello scontrino"}
          </button>
          {receipt.message && (
            <p className={`alert ${receipt.status === "error" ? "alert-error" : "alert-ok"}`} style={{ marginTop: 10 }}>
              {receipt.message}
            </p>
          )}
        </div>
      )}

      <div className="form-grid toggles">
        <div className="seg seg-full" role="radiogroup" aria-label="Ambito">
          <label className={scope === "work" ? "active" : ""}>
            <input type="radio" checked={scope === "work"} onChange={() => choose("work", kind)} />
            <Briefcase size={16} /> Work
          </label>
          <label className={scope === "life" ? "active" : ""}>
            <input type="radio" checked={scope === "life"} onChange={() => choose("life", kind)} />
            <Home size={16} /> Life
          </label>
        </div>
        <div className="seg seg-full" role="radiogroup" aria-label="Tipo di movimento">
          <label className={`kind-in ${kind === "entrata" ? "active" : ""}`}>
            <input type="radio" name="kind" value="entrata" checked={kind === "entrata"} onChange={() => choose(scope, "entrata")} />
            <ArrowDownLeft size={16} style={{ color: "var(--k)" }} /> Entrata
          </label>
          <label className={`kind-out ${kind === "uscita" ? "active" : ""}`}>
            <input type="radio" name="kind" value="uscita" checked={kind === "uscita"} onChange={() => choose(scope, "uscita")} />
            <ArrowUpRight size={16} style={{ color: "var(--k)" }} /> Uscita
          </label>
        </div>
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

      <label className="field">
        <span>Descrizione</span>
        <input
          name="description"
          maxLength={300}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder={scope === "life" ? "Spesa Esselunga" : kind === "entrata" ? "Fattura n. 12 – Rossi Srl" : "Abbonamento Figma"}
        />
        {ruleHint && (
          <small className="row" style={{ gap: 6 }}>
            <Wand2 size={13} /> {ruleHint}
          </small>
        )}
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Data</span>
          <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select
            name="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCategoryTouched(true);
              setRuleHint("");
              setIva(ivaFor(scope, kind, e.target.value));
            }}
          >
            {options(scope, kind).map((c) => (
              <option key={c}>{c}</option>
            ))}
            {!options(scope, kind).includes(category) && <option>{category}</option>}
          </select>
        </label>
      </div>

      {showIva && (
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

      {showIva && kind === "uscita" && (
        <p className="alert alert-info small">
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {rule.deducibile > 0 ? `Deducibile al ${Math.round(rule.deducibile * 100)}%` : "Non deducibile"}
            {rule.ivaDetraibile > 0 && rule.ivaDetraibile < 1 ? `, IVA detraibile al ${Math.round(rule.ivaDetraibile * 100)}%` : ""}
            {rule.nota ? `. ${rule.nota}` : "."}
          </span>
        </p>
      )}
      {scope === "life" && <p className="small muted">Le spese Life sono personali: non entrano nel calcolo di tasse e IVA.</p>}

      {state.message && !state.ok && <p className="alert alert-error">{state.message}</p>}

      <button className="btn btn-primary btn-block" disabled={pending} style={{ padding: "14px 16px" }}>
        {pending ? "Salvataggio…" : editing ? "Salva modifiche" : kind === "entrata" ? "Aggiungi entrata" : "Aggiungi uscita"}
      </button>
    </form>
  );
}
