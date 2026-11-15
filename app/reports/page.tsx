import { DeleteReportButton } from "@/components/DeleteReportButton";
import { ReportView } from "@/components/ReportView";
import { longLabel, type Period } from "@/lib/finance";
import { BASIC_MODEL } from "@/lib/report";
import { createClient } from "@/lib/supabase/server";

const NAME: Record<Period, string> = { giorno: "Giornaliero", settimana: "Settimanale", mese: "Mensile" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, period, period_start, period_end, content, model, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="stack-lg">
      <h1>Report salvati</h1>
      {error && <p className="alert alert-error">{error.message}</p>}
      {!error && (reports ?? []).length === 0 && (
        <p className="card muted">Nessun report ancora. Generane uno dalla dashboard.</p>
      )}
      {(reports ?? []).map((r, i) => (
        <details key={r.id} className="card report-item" open={i === 0}>
          <summary>
            <span className="badge">{NAME[r.period as Period]}</span>
            <span className="badge badge-muted">{r.model === BASIC_MODEL ? "Automatico" : "AI"}</span>
            <strong>{longLabel(r.period as Period, { start: r.period_start, end: r.period_end })}</strong>
            <span className="muted small">
              {new Date(r.created_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" })}
            </span>
          </summary>
          <ReportView content={r.content} filename={`report-${r.period}-${r.period_start}.md`} />
          <DeleteReportButton id={r.id} />
        </details>
      ))}
    </div>
  );
}
