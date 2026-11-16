import { ChevronRight, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
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

  const list = reports ?? [];
  return (
    <div className="stack-lg" style={{ maxWidth: 880 }}>
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Archivio</div>
          <h1 className="page-title">Report salvati</h1>
        </div>
      </header>
      {error && <p className="alert alert-error">{error.message}</p>}
      {!error && list.length === 0 && (
        <div className="card empty">
          <span className="empty-icon">
            <FileText size={24} />
          </span>
          <p style={{ marginBottom: 14 }}>Nessun report ancora.</p>
          <Link href="/" className="btn btn-primary btn-sm">
            <Sparkles size={16} /> Generane uno dalla dashboard
          </Link>
        </div>
      )}
      {list.map((r, i) => (
        <details key={r.id} className="card report-item" open={i === 0}>
          <summary>
            <span className="card-icon">
              <FileText size={18} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650, textTransform: "capitalize" }}>
                {longLabel(r.period as Period, { start: r.period_start, end: r.period_end })}
              </div>
              <div className="small muted">
                {new Date(r.created_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" })}
              </div>
            </div>
            <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
              <span className="badge">{NAME[r.period as Period]}</span>
              <span className="badge badge-muted">{r.model === BASIC_MODEL ? "Automatico" : "AI"}</span>
            </span>
            <ChevronRight size={18} className="chev" style={{ marginLeft: 4 }} />
          </summary>
          <ReportView content={r.content} filename={`report-${r.period}-${r.period_start}.md`} />
          <div className="report-foot">
            <DeleteReportButton id={r.id} />
          </div>
        </details>
      ))}
    </div>
  );
}
