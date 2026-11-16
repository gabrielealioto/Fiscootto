"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
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

export function ReportPanel({ period, date, label, aiEnabled }: { period: Period; date: string; label: string; aiEnabled: boolean }) {
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

  const visible = report && report.period === period && report.period_start <= date ? report : null;

  return (
    <section className="card report-card">
      <div className="card-head" style={{ marginBottom: 0, alignItems: "center", flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 14 }}>
          <span className="card-icon">
            <Sparkles size={19} />
          </span>
          <div>
            <h2 className="row" style={{ gap: 8 }}>
              Report {NAME[period]} {!aiEnabled && <span className="badge badge-muted">Automatico · gratuito</span>}
            </h2>
            <p className="small muted">
              {aiEnabled ? "Analisi di Claude" : "Analisi automatica"} di {label} ·{" "}
              <Link href="/reports">report salvati</Link>
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}
          {loading ? "Sto scrivendo…" : visible ? "Rigenera" : "Genera report"}
        </button>
      </div>
      {loading && <div className="loading-bar" aria-hidden />}
      {error && (
        <p className="alert alert-error" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}
      {warning && (
        <p className="alert alert-warn" style={{ marginTop: 14 }}>
          {warning}
        </p>
      )}
      {visible && <ReportView content={visible.content} filename={`report-${visible.period}-${visible.period_start}.md`} />}
    </section>
  );
}
