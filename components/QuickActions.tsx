"use client";

import { Camera, ChevronRight, FileSpreadsheet, PenLine, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Transaction } from "@/lib/finance";
import { CsvImport } from "./CsvImport";
import { Sheet } from "./Sheet";
import { TransactionForm, type FormContext } from "./TransactionForm";

type Open =
  | { type: "add"; receipt?: boolean }
  | { type: "edit"; tx: Transaction }
  | { type: "import" }
  | { type: "menu" }
  | null;

const EVENT = "fiscootto:open";
const emit = (detail: Open) => window.dispatchEvent(new CustomEvent(EVENT, { detail }));

export const openAdd = () => emit({ type: "add" });
export const openReceipt = () => emit({ type: "add", receipt: true });
export const openImport = () => emit({ type: "import" });
export const openEdit = (tx: Transaction) => emit({ type: "edit", tx });
export const openMenu = () => emit({ type: "menu" });

/** Finestre globali (nuovo, modifica, foto, import), apribili da ogni punto dell'app. */
export function QuickActionsHost(ctx: FormContext) {
  const [open, setOpen] = useState<Open>(null);

  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<Open>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  const close = useCallback(() => setOpen(null), []);
  const title =
    open?.type === "edit" ? "Modifica movimento" : open?.type === "add" ? (open.receipt ? "Spesa da scontrino" : "Nuovo movimento") : "";

  return (
    <>
      <Sheet open={open?.type === "add" || open?.type === "edit"} onClose={close} title={title}>
        {open?.type === "add" && <TransactionForm {...ctx} onDone={close} startWithReceipt={open.receipt} />}
        {open?.type === "edit" && <TransactionForm {...ctx} onDone={close} initial={open.tx} />}
      </Sheet>
      <Sheet open={open?.type === "import"} onClose={close} title="Importa dalla banca">
        <CsvImport onDone={close} regime={ctx.regime} />
      </Sheet>
      <Sheet open={open?.type === "menu"} onClose={close} title="Aggiungi">
        <div className="option-list">
          <button className="option" onClick={() => setOpen({ type: "add" })}>
            <span className="row" style={{ gap: 12 }}>
              <span className="card-icon">
                <PenLine size={18} />
              </span>
              <span>
                <strong style={{ display: "block" }}>Nuovo movimento</strong>
                <span className="small muted">Entrata o uscita, Work o Life</span>
              </span>
            </span>
            <ChevronRight size={18} className="subtle" />
          </button>
          {ctx.aiEnabled && (
            <button className="option" onClick={() => setOpen({ type: "add", receipt: true })}>
              <span className="row" style={{ gap: 12 }}>
                <span className="card-icon">
                  <Camera size={18} />
                </span>
                <span>
                  <strong style={{ display: "block" }}>Foto dello scontrino</strong>
                  <span className="small muted">Leggo importo, data e negozio</span>
                </span>
              </span>
              <ChevronRight size={18} className="subtle" />
            </button>
          )}
          <button className="option" onClick={() => setOpen({ type: "import" })}>
            <span className="row" style={{ gap: 12 }}>
              <span className="card-icon">
                <FileSpreadsheet size={18} />
              </span>
              <span>
                <strong style={{ display: "block" }}>Importa CSV della banca</strong>
                <span className="small muted">Con le tue regole di categoria</span>
              </span>
            </span>
            <ChevronRight size={18} className="subtle" />
          </button>
        </div>
      </Sheet>
    </>
  );
}

export function AddButton({ className = "btn btn-primary" }: { className?: string }) {
  return (
    <button className={className} onClick={openAdd}>
      <Plus size={18} /> Nuovo movimento
    </button>
  );
}

export function ReceiptButton({ className = "btn btn-secondary" }: { className?: string }) {
  return (
    <button className={className} onClick={openReceipt}>
      <Camera size={18} /> Scontrino
    </button>
  );
}

export function ImportButton({ className = "btn btn-secondary" }: { className?: string }) {
  return (
    <button className={className} onClick={openImport}>
      <FileSpreadsheet size={18} /> Importa CSV
    </button>
  );
}
