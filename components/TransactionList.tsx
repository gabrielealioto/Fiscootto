"use client";

import { useTransition } from "react";
import { deleteTransaction } from "@/app/actions";
import { formatEur, type Transaction } from "@/lib/finance";

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [pending, start] = useTransition();

  if (transactions.length === 0) return <p className="muted">Nessun movimento in questo periodo.</p>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrizione</th>
            <th className="hide-sm">Categoria</th>
            <th className="num">Importo</th>
            <th aria-label="Azioni" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="nowrap">{new Date(`${t.date}T00:00:00Z`).toLocaleDateString("it-IT", { timeZone: "UTC" })}</td>
              <td className="ellipsis">{t.description || <span className="muted">—</span>}</td>
              <td className="nowrap hide-sm">{t.category}</td>
              <td className={`num nowrap ${t.kind === "entrata" ? "pos" : "neg"}`}>
                {t.kind === "uscita" ? "−" : "+"}
                {formatEur(t.amount)}
              </td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  aria-label={`Elimina ${t.description || "movimento"}`}
                  onClick={() => {
                    if (confirm("Eliminare questo movimento?")) start(() => deleteTransaction(t.id));
                  }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
