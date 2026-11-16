import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Info,
  Landmark,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { categoryIcon } from "@/lib/categories";
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
import { GESTIONE_INFO } from "@/lib/inps";
import { BarChart } from "./BarChart";
import { AddButton, ImportButton } from "./QuickActions";
import { ReportPanel } from "./ReportPanel";
import { Sparkline } from "./Sparkline";
import { TransactionList } from "./TransactionList";

const PERIOD_LABEL: Record<Period, string> = { giorno: "Giorno", settimana: "Settimana", mese: "Mese" };
const PERIOD_NOUN: Record<Period, string> = { giorno: "Oggi", settimana: "Questa settimana", mese: "Questo mese" };

interface Props {
  summary: PeriodSummary;
  transactions: Transaction[];
  today: string;
  refDate: string;
  settings: TaxSettings;
  aiEnabled: boolean;
}

const pct = (n: number) => `${(n * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null || value === 0) return <span className="delta delta-flat">{value === null ? "nuovo" : "="}</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`delta ${good ? "delta-good" : "delta-bad"}`}>
      <Icon size={13} strokeWidth={2.4} /> {formatPct(value)}
    </span>
  );
}

export function Dashboard({ summary, transactions, today, refDate, settings, aiEnabled }: Props) {
  const { period, range, current, previous, change, tax, taxYtd } = summary;
  const prev = shiftPeriod(period, refDate, -1).start;
  const next = shiftPeriod(period, refDate, 1).start;
  const isCurrent = range.start <= today && today <= range.end;
  const href = (p: Period, d?: string) => `/?p=${p}${d ? `&d=${d}` : ""}`;
  const label = longLabel(period, range);
  const maxCat = Math.max(1, ...summary.categories.map((c) => c.amount));
  const margin = current.entrate > 0 ? current.utile / current.entrate : null;
  const avgProfit = summary.history.reduce((s, h) => s + h.totals.utile, 0) / Math.max(1, summary.history.length);

  // Dove vanno gli incassi: quanto resta e quanto va in contributi e imposta.
  const resta = Math.max(0, current.entrate - tax.totale);
  const ordinario = tax.regime === "ordinario";
  const ivaDaVersare = Math.max(0, tax.iva);
  const parts = [
    { key: "net", cls: "p-net", label: "Resta a te", value: resta, color: "var(--c-profit)" },
    { key: "inps", cls: "p-inps", label: tax.contributiFissi > 0 ? "Contributi INPS (con i fissi)" : "Contributi INPS", value: tax.contributi, color: "var(--c-tax)" },
    {
      key: "tax",
      cls: "p-tax",
      label: ordinario ? "IRPEF e addizionali" : "Imposta sostitutiva",
      value: tax.imposta,
      color: "var(--c-tax-2)",
    },
    ...(ordinario ? [{ key: "iva", cls: "p-iva", label: "IVA da versare", value: ivaDaVersare, color: "var(--c-iva)" }] : []),
  ];
  const share = (v: number) => (current.entrate > 0 ? v / current.entrate : 0);

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <div className="eyebrow">{isCurrent ? PERIOD_NOUN[period] : PERIOD_LABEL[period]}</div>
          <h1 className="page-title">{label}</h1>
        </div>
        <div className="toolbar">
          <div className="seg" role="tablist" aria-label="Periodo">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={href(p, isCurrent ? undefined : refDate)}
                className={p === period ? "active" : ""}
                role="tab"
                aria-selected={p === period}
              >
                {PERIOD_LABEL[p]}
              </Link>
            ))}
          </div>
          <div className="period-nav">
            <Link href={href(period, prev)} className="btn btn-ghost" aria-label="Periodo precedente">
              <ChevronLeft size={18} />
            </Link>
            {!isCurrent && (
              <Link href={href(period)} className="btn btn-ghost btn-sm">
                Oggi
              </Link>
            )}
            {next <= today ? (
              <Link href={href(period, next)} className="btn btn-ghost" aria-label="Periodo successivo">
                <ChevronRight size={18} />
              </Link>
            ) : (
              <span className="btn btn-ghost disabled" aria-hidden>
                <ChevronRight size={18} />
              </span>
            )}
          </div>
          <div className="actions">
            <ImportButton />
            <AddButton />
          </div>
        </div>
      </header>

      <section className="grid grid-3">
        {/* Profitto: il numero principale */}
        <div className="card hero span-2">
          <Sparkline className="hero-spark" values={summary.history.map((h) => h.totals.utile)} color="#7ee2bd" />
          <div className="hero-label">
            <span className="dot" style={{ background: "#7ee2bd" }} /> Profitto · {label}
          </div>
          <div className="row wrap" style={{ alignItems: "baseline", gap: 14 }}>
            <span className="hero-value">{formatEur(current.utile)}</span>
            <Delta value={change.utile} />
          </div>
          <div className="hero-split">
            <div>
              <span>Netto dopo le tasse</span>
              <strong>{formatEur(current.utile - tax.totale)}</strong>
            </div>
            <div>
              <span>Media ultimi {summary.history.length} periodi</span>
              <strong>{formatEur(avgProfit)}</strong>
            </div>
          </div>
        </div>

        {/* Tasse da accantonare */}
        <div className="card tile kcard kind-tax full-sm">
          <div className="tile-top">
            <span className="tile-label">
              <span className="kchip">
                <PiggyBank size={19} />
              </span>
              {ordinario ? "Tasse e IVA da accantonare" : "Tasse da accantonare"}
            </span>
          </div>
          <div className="tile-value">{formatEur(tax.totale)}</div>
          <div className="tile-sub">
            {current.entrate > 0 ? `${pct(tax.quotaSuIncassi)} degli incassi del periodo` : "Nessun incasso nel periodo"}
            {tax.contributiFissi > 0 && ` · di cui ${formatEur(tax.contributiFissi)} di contributi fissi`}
            {ordinario && ivaDaVersare > 0 && ` · di cui ${formatEur(ivaDaVersare)} di IVA`}
          </div>
          <div className="meter" aria-hidden>
            <i style={{ width: `${Math.min(100, tax.quotaSuIncassi * 100)}%`, background: "var(--c-tax)" }} />
          </div>
          <div className="tile-sub" style={{ justifyContent: "space-between" }}>
            <span>Da inizio anno</span>
            <strong style={{ color: "var(--fg)" }}>{formatEur(taxYtd.totale)}</strong>
          </div>
        </div>

        {/* Le tre voci */}
        <div className="card tile kcard kind-in">
          <div className="tile-top">
            <span className="tile-label">
              <span className="kchip">
                <ArrowDownLeft size={19} />
              </span>
              Entrate
            </span>
            <Delta value={change.entrate} />
          </div>
          <div className="tile-value">{formatEur(current.entrate)}</div>
          <div className="tile-sub">Periodo precedente {formatEur(previous.entrate)}</div>
        </div>
        <div className="card tile kcard kind-out">
          <div className="tile-top">
            <span className="tile-label">
              <span className="kchip">
                <ArrowUpRight size={19} />
              </span>
              Uscite
            </span>
            <Delta value={change.uscite} invert />
          </div>
          <div className="tile-value">{formatEur(current.uscite)}</div>
          <div className="tile-sub">Periodo precedente {formatEur(previous.uscite)}</div>
        </div>
        <div className="card tile kcard kind-profit full-sm">
          <div className="tile-top">
            <span className="tile-label">
              <span className="kchip">
                <TrendingUp size={19} />
              </span>
              Margine
            </span>
          </div>
          <div className="tile-value">{margin === null ? "—" : pct(margin)}</div>
          <div className="tile-sub">Profitto su entrate · {current.movimenti} movimenti</div>
        </div>

        {/* Andamento */}
        <div className="card span-2">
          <div className="card-head">
            <div>
              <h2>Andamento</h2>
              <p className="small muted">Ultimi {summary.history.length} periodi</p>
            </div>
          </div>
          <BarChart
            data={summary.history.map((h) => ({
              label: h.label,
              longLabel: longLabel(period, h.range),
              entrate: h.totals.entrate,
              uscite: h.totals.uscite,
              utile: h.totals.utile,
            }))}
          />
        </div>

        {/* Uscite per categoria */}
        <div className="card full-sm">
          <div className="card-head">
            <div>
              <h2>Dove spendi</h2>
              <p className="small muted">Uscite per categoria</p>
            </div>
          </div>
          {summary.categories.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">
                <Receipt size={24} />
              </span>
              <p className="small">Nessuna uscita nel periodo.</p>
            </div>
          ) : (
            <ul className="cats">
              {summary.categories.slice(0, 6).map((c) => {
                const Icon = categoryIcon(c.category, "uscita");
                return (
                  <li key={c.category} className="cat">
                    <span className="cat-icon kind-out" style={{ background: "var(--k-soft)", color: "var(--k-ink)" }}>
                      <Icon size={18} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="cat-name">{c.category}</div>
                      <div className="cat-bar">
                        <i style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                      </div>
                    </div>
                    <div className="cat-amount">
                      {formatEur(c.amount)}
                      <small>{pct(c.amount / Math.max(1, current.uscite))}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Dove vanno gli incassi */}
        <div className="card span-3">
          <div className="card-head">
            <div>
              <h2>Dove vanno i tuoi incassi</h2>
              <p className="small muted">
                {ordinario
                  ? `Regime ordinario: ricavi ${formatEur(tax.ricavi)} senza IVA, spese deducibili ${formatEur(tax.costiDeducibili)}`
                  : `Stima forfettario su ${formatEur(current.entrate)} incassati nel periodo`}
              </p>
            </div>
            <span className="kchip kind-tax">
              <Landmark size={19} />
            </span>
          </div>
          {current.entrate > 0 ? (
            <div
              className="segbar"
              role="img"
              aria-label={parts.map((p) => `${p.label} ${formatEur(p.value)} (${pct(share(p.value))})`).join(", ")}
            >
              {parts
                .filter((p) => p.value > 0)
                .map((p) => (
                  <div key={p.key} className={p.cls} style={{ flex: `${p.value} 1 0` }} title={`${p.label}: ${formatEur(p.value)}`}>
                    {share(p.value) >= 0.09 ? pct(share(p.value)) : ""}
                  </div>
                ))}
            </div>
          ) : (
            <div className="segbar-empty" />
          )}
          <div className="parts">
            {parts.map((p) => (
              <div key={p.key} className="part">
                <i style={{ background: p.color }} />
                <div>
                  <span>{p.label}</span>
                  <strong>{formatEur(p.value)}</strong>
                </div>
              </div>
            ))}
          </div>
          <div className="ytd">
            <span className="muted">
              Da inizio anno: incassi <strong style={{ color: "var(--fg)" }}>{formatEur(taxYtd.incassi)}</strong>
              {ordinario && (
                <>
                  , spese deducibili <strong style={{ color: "var(--fg)" }}>{formatEur(taxYtd.costiDeducibili)}</strong>
                </>
              )}
              , {ordinario ? "tasse e IVA stimate" : "tasse stimate"} <strong style={{ color: "var(--fg)" }}>{formatEur(taxYtd.totale)}</strong>
            </span>
            <span className="small subtle row" style={{ gap: 6 }}>
              <Info size={14} />
              {ordinario
                ? `Regime ordinario · ${GESTIONE_INFO[settings.gestione ?? "separata"].label} ${pct(settings.aliquota_contributi)} · IRPEF a scaglioni`
                : `Coefficiente ${pct(settings.coefficiente)} · ${GESTIONE_INFO[settings.gestione ?? "separata"].label} ${pct(settings.aliquota_contributi)} · imposta ${pct(settings.aliquota_imposta)}`}{" "}
              · <Link href="/settings">modifica</Link>
            </span>
          </div>
        </div>

        <div className="span-3">
          <ReportPanel period={period} date={refDate} label={label} aiEnabled={aiEnabled} />
        </div>

        <div className="card span-3">
          <div className="card-head">
            <div>
              <h2>Movimenti</h2>
              <p className="small muted">
                {transactions.length} {transactions.length === 1 ? "movimento" : "movimenti"} nel periodo
              </p>
            </div>
          </div>
          <TransactionList transactions={transactions} />
        </div>
      </section>
    </div>
  );
}
