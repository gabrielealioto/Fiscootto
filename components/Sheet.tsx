"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/** Finestra modale (dialog nativo): centrata su desktop, dal basso su telefono. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Se la chiusura arriva dal codice (open = false) non va segnalata di nuovo al genitore.
  const programmatic = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      programmatic.current = true;
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={() => {
        if (programmatic.current) programmatic.current = false;
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // clic sullo sfondo
      }}
      aria-label={title}
    >
      <div className="sheet-head">
        <h2>{title}</h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Chiudi">
          <X size={18} />
        </button>
      </div>
      <div className="sheet-body">{open && children}</div>
    </dialog>
  );
}
