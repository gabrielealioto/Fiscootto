"use client";

import { FileSpreadsheet, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { CsvImport } from "./CsvImport";
import { Sheet } from "./Sheet";
import type { Regime } from "@/lib/ordinario";
import { TransactionForm } from "./TransactionForm";

const ADD = "fiscootto:add";
const IMPORT = "fiscootto:import";

export const openAdd = () => window.dispatchEvent(new Event(ADD));
export const openImport = () => window.dispatchEvent(new Event(IMPORT));

/** Le due finestre globali (nuovo movimento, import CSV), apribili da ogni punto dell'app. */
export function QuickActionsHost({ regime }: { regime: Regime }) {
  const [sheet, setSheet] = useState<"add" | "import" | null>(null);

  useEffect(() => {
    const add = () => setSheet("add");
    const imp = () => setSheet("import");
    window.addEventListener(ADD, add);
    window.addEventListener(IMPORT, imp);
    return () => {
      window.removeEventListener(ADD, add);
      window.removeEventListener(IMPORT, imp);
    };
  }, []);

  const close = () => setSheet(null);
  return (
    <>
      <Sheet open={sheet === "add"} onClose={close} title="Nuovo movimento">
        <TransactionForm onDone={close} regime={regime} />
      </Sheet>
      <Sheet open={sheet === "import"} onClose={close} title="Importa dalla banca">
        <CsvImport onDone={close} regime={regime} />
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

export function ImportButton({ className = "btn btn-secondary" }: { className?: string }) {
  return (
    <button className={className} onClick={openImport}>
      <FileSpreadsheet size={18} /> Importa CSV
    </button>
  );
}
