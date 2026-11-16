"use client";

import { Inbox, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteTransaction } from "@/app/actions";
import { categoryIcon } from "@/lib/categories";
import { formatEur, type Transaction } from "@/lib/finance";
import { AddButton } from "./QuickActions";

const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [pending, start] = useTransition();

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon">
          <Inbox size={24} />
        </span>
        <p style={{ marginBottom: 14 }}>Nessun movimento in questo periodo.</p>
        <AddButton className="btn btn-secondary btn-sm" />
      </div>
    );
  }

  // Raggruppa per giorno (la lista arriva già ordinata dalla più recente).
  const days = new Map<string, Transaction[]>();
  for (const t of transactions) days.set(t.date, [...(days.get(t.date) ?? []), t]);

  return (
    <div>
      {[...days.entries()].map(([date, txs]) => {
        const net = txs.reduce((s, t) => s + (t.kind === "entrata" ? t.amount : -t.amount), 0);
        return (
          <section key={date}>
            <div className="tx-day">
              <span>{dayFmt.format(new Date(`${date}T00:00:00Z`))}</span>
              <span className="num">{net >= 0 ? "+" : "−"}{formatEur(Math.abs(net))}</span>
            </div>
            {txs.map((t) => {
              const Icon = categoryIcon(t.category, t.kind);
              const isIn = t.kind === "entrata";
              return (
                <div key={t.id} className={`tx ${isIn ? "tx-in kind-in" : "kind-out"}`}>
                  <span className="tx-icon" style={{ background: "var(--k-soft)", color: "var(--k-ink)" }}>
                    <Icon size={19} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="tx-title">{t.description || t.category}</div>
                    <div className="tx-meta">
                      <span className="ktag" style={{ fontWeight: 550, color: "var(--subtle)" }}>
                        {isIn ? "Entrata" : "Uscita"}
                      </span>{" "}
                      · {t.category}
                      {(t.iva ?? 0) > 0 && ` · IVA ${t.iva}%`}
                    </div>
                  </div>
                  <span className="tx-amount" style={{ color: "var(--fg)" }}>
                    {isIn ? "+" : "−"}
                    {formatEur(t.amount)}
                  </span>
                  <button
                    className="btn btn-ghost btn-icon"
                    disabled={pending}
                    aria-label={`Elimina ${t.description || "movimento"}`}
                    onClick={() => {
                      if (confirm("Eliminare questo movimento?")) start(() => deleteTransaction(t.id));
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
