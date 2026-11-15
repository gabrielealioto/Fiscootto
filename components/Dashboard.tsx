import Link from "next/link";
import {
  formatEur,
  formatPct,
  longLabel,
  PERIODS,
  shiftPeriod,
  type Period,
  type PeriodSummary,
  type TaxSettings,
  type Transaction,
} from "@/lib/finance";
import { BarChart } from "./BarChart";
import { CsvImport } from "./CsvImport";
import { ReportPanel } from "./ReportPanel";
import { TransactionForm } from "./TransactionForm";
import { TransactionList } from "./TransactionList";

const PERIOD_LABEL: Record<Period, string> = { giorno: "Giorno", settimana: "Settimana", mese: "Mese" };

interface Props {
  summary: PeriodSummary;
  transactions: Transaction[];
  today: string;
  refDate: string;
  settings: TaxSettings;
}

export function Dashboard({ summary, transactions, today, refDate, settings }: Props) {
  const { period, range, current, previous, change, tax, taxYtd } = summary;
  const prev = shiftPeriod(period, refDate, -1).start;
  const next = shiftPeriod(period, refDate, 1).start;
  const isCurrent = range.start <= today && today <= range.end;
  const href = (p: Period, d?: string) => `/?p=${p}${d ? `&d=${d}` : ""}`;
  const maxCat = Math.max(1, ...summary.categories.map((c) => c.amount));
  const pct = (n: number) => `${(n * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;

  return (
    <div className="stack-lg">
      <section className="toolbar">
        <div className="segmented" role="tablist" aria-label="Periodo">
          {PERIODS.map((p) => (
            <Link key={p} href={href(p, isCurrent ? undefined : refDate)} className={p === period ? "active" : ""} role="tab" aria-selected={p === period}>
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        <div className="period-nav">
          <Link href={href(period, prev)} className="btn btn-ghost btn-sm" aria-label="Periodo precedente">
            ←
          </Link>
          <h1 className="period-title">{longLabel(period, range)}</h1>
          {next <= today ? (
            <Link href={href(period, next)} className="btn btn-ghost btn-sm" aria-label="Periodo successivo">
              →
            </Link>
          ) : (
            <span className="btn btn-ghost btn-sm disabled" aria-hidden>
              →
            </span>
          )}
          {!isCurrent && (
            <Link href={href(period)} className="btn btn-ghost btn-sm">
              Oggi
            </Link>
          )}
        </div>
      </section>

      <section className="kpis">
        <Kpi label="Entrate" value={current.entrate} change={change.entrate} previous={previous.entrate} tone="pos" />
        <Kpi label="Uscite" value={current.uscite} change={change.uscite} previous={previous.uscite} tone="neg" invert />
        <Kpi label="Utile" value={current.utile} change={change.utile} previous={previous.utile} tone={current.utile >= 0 ? "pos" : "neg"} />
        <div className="card kpi kpi-accent">
          <span className="kpi-label">Da accantonare</span>
          <span className="kpi-value">{formatEur(tax.totale)}</span>
          <span className="kpi-sub">{current.entrate > 0 ? `${pct(tax.quotaSuIncassi)} degli incassi` : "nessun incasso nel periodo"}</span>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Ultimi 6 periodi</h2>
          <BarChart data={summary.history.map((h) => ({ label: h.label, entrate: h.totals.entrate, uscite: h.totals.uscite }))} />
        </div>
        <div className="card">
          <h2>Uscite per categoria</h2>
          {summary.categories.length === 0 ? (
            <p className="muted">Nessuna uscita nel periodo.</p>
          ) : (
            <ul className="cats">
              {summary.categories.map((c) => (
                <li key={c.category}>
                  <div className="cat-row">
                    <span>{c.category}</span>
                    <span className="num">{formatEur(c.amount)}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Stima fiscale forfettario</h2>
        <div className="tax-grid">
          <TaxColumn title={`Periodo (incassi ${formatEur(current.entrate)})`} t={tax} />
          <TaxColumn title={`Da inizio anno (incassi ${formatEur(taxYtd.incassi)})`} t={taxYtd} />
        </div>
        <p className="muted small">
          Coefficiente {pct(settings.coefficiente)} · INPS {pct(settings.aliquota_contributi)} · imposta sostitutiva {pct(settings.aliquota_imposta)}.{" "}
          <Link href="/settings">Modifica</Link>. Stime indicative: non sostituiscono il commercialista.
        </p>
      </section>

      <ReportPanel period={period} date={refDate} label={longLabel(period, range)} />

      <section className="grid-2">
        <div className="card">
          <h2>Nuovo movimento</h2>
          <TransactionForm defaultDate={isCurrent ? today : range.end} />
        </div>
        <div className="card">
          <h2>Importa CSV della banca</h2>
          <CsvImport />
        </div>
      </section>

      <section className="card">
        <h2>
          Movimenti del periodo <span className="muted">({transactions.length})</span>
        </h2>
        <TransactionList transactions={transactions} />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  change,
  previous,
  tone,
  invert = false,
}: {
  label: string;
  value: number;
  change: number | null;
  previous: number;
  tone: "pos" | "neg";
  invert?: boolean;
}) {
  // Per le uscite un aumento è una cattiva notizia.
  const good = change === null ? null : invert ? change < 0 : change > 0;
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${tone}`}>{formatEur(value)}</span>
      <span className="kpi-sub">
        <span className={good === null ? "" : good ? "delta-good" : "delta-bad"}>{formatPct(change)}</span> vs {formatEur(previous)}
      </span>
    </div>
  );
}

function TaxColumn({ title, t }: { title: string; t: { imponibile: number; contributi: number; imposta: number; totale: number } }) {
  return (
    <div>
      <h3>{title}</h3>
      <dl className="tax-list">
        <dt>Imponibile</dt>
        <dd>{formatEur(t.imponibile)}</dd>
        <dt>Contributi INPS</dt>
        <dd>{formatEur(t.contributi)}</dd>
        <dt>Imposta sostitutiva</dt>
        <dd>{formatEur(t.imposta)}</dd>
        <dt className="strong">Da accantonare</dt>
        <dd className="strong">{formatEur(t.totale)}</dd>
      </dl>
    </div>
  );
}
