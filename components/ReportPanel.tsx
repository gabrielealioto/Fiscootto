"use client";

import Link from "next/link";
import { useState } from "react";
import type { Period } from "@/lib/finance";
import { ReportView } from "./ReportView";

const NAME: Record<Period, string> = { giorno: "giornaliero", settimana: "settimanale", mese: "mensile" };

interface Report {
  id: string | null;
  period: Period;
  period_start: string;
  content: string;
}

export function ReportPanel({ period, date, label }: { period: Period; date: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  async function generate() {
    setLoading(true);
    setError("");
    setWarning("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
      setReport(data.report);
      if (data.warning) setWarning(data.warning);
    } catch (e) {
      setError((e as Error).message === "Failed to fetch" ? "Sei offline: il report richiede la connessione." : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Il report mostrato si riferisce sempre al periodo corrente della dashboard.
  const visible = report && report.period === period ? report : null;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Report AI</h2>
          <p className="muted small">
            Analisi {NAME[period]} di {label}, scritta da Claude a partire dai tuoi numeri. <Link href="/reports">Report salvati</Link>
          </p>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? "Sto scrivendo il report…" : `Genera report ${NAME[period]}`}
        </button>
      </div>
      {loading && <div className="loading-bar" aria-hidden />}
      {error && <p className="alert alert-error">{error}</p>}
      {warning && <p className="alert alert-warn">{warning}</p>}
      {visible && <ReportView content={visible.content} filename={`report-${visible.period}-${visible.period_start}.md`} />}
    </section>
  );
}
