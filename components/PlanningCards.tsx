import { Bell, CalendarClock, ChevronRight, CircleAlert, PiggyBank, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatEur } from "@/lib/finance";
import { dueStatus, SCOPE_LABEL, type Alert, type BudgetStatus, type GoalStatus, type Recurring } from "@/lib/planning";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const dateIt = (iso: string) => iso.split("-").reverse().join("/");
const DUE_LABEL = { scaduta: "scaduta", oggi: "oggi", presto: "a breve", futura: "" } as const;

export function AlertsList({ alerts, max = 4 }: { alerts: Alert[]; max?: number }) {
  if (alerts.length === 0) return null;
  const shown = alerts.slice(0, max);
  return (
    <section className="alerts" aria-label="Avvisi">
      {shown.map((a) => (
        <Link key={a.id} href={a.href} className={`alert-row ${a.level}`}>
          <span className="ai">{a.level === "critico" ? <CircleAlert size={18} /> : a.level === "attenzione" ? <TriangleAlert size={18} /> : <Bell size={18} />}</span>
          <span style={{ minWidth: 0 }}>
            <strong>{a.title}</strong>
            <span className="small">{a.detail}</span>
          </span>
          <ChevronRight size={18} className="subtle" />
        </Link>
      ))}
      {alerts.length > max && (
        <Link href="/pianifica" className="small" style={{ paddingLeft: 4 }}>
          Altri {alerts.length - max} avvisi in Pianifica
        </Link>
      )}
    </section>
  );
}

export function BudgetMeter({ b }: { b: BudgetStatus }) {
  return (
    <div className={`meter ${b.level === "superato" ? "meter-over" : b.level === "attenzione" ? "meter-warn" : ""}`} aria-hidden>
      <i style={{ width: `${Math.min(100, b.ratio * 100)}%`, background: "var(--brand)" }} />
    </div>
  );
}

function CardHead({ icon, title, sub, href }: { icon: React.ReactNode; title: string; sub: string; href: string }) {
  return (
    <div className="card-head">
      <div className="row" style={{ gap: 12 }}>
        <span className="card-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p className="small muted">{sub}</p>
        </div>
      </div>
      <Link href={href} className="btn btn-ghost btn-sm">
        Gestisci
      </Link>
    </div>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="empty" style={{ padding: "12px 4px" }}>
      <p className="small" style={{ marginBottom: 10 }}>
        {text}
      </p>
      <Link href={href} className="btn btn-secondary btn-sm">
        {cta}
      </Link>
    </div>
  );
}

export function BudgetCard({ budgets }: { budgets: BudgetStatus[] }) {
  return (
    <div className="card">
      <CardHead icon={<Target size={18} />} title="Budget del mese" sub="Spesa rispetto ai tetti" href="/pianifica#budget" />
      {budgets.length === 0 ? (
        <Empty text="Fissa un tetto di spesa mensile per le categorie che vuoi tenere d'occhio." href="/pianifica#budget" cta="Crea un budget" />
      ) : (
        <div className="plan-list">
          {budgets.slice(0, 4).map((b) => (
            <div key={b.id} className="plan-item">
              <span className="plan-title">
                <span className={`scope-chip ${b.scope}`}>{SCOPE_LABEL[b.scope]}</span>
                <span>{b.category}</span>
              </span>
              <span className="small num">
                <strong>{formatEur(b.spent)}</strong> <span className="muted">/ {formatEur(b.monthly_limit)}</span>
              </span>
              <BudgetMeter b={b} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UpcomingCard({ recurring, today }: { recurring: Recurring[]; today: string }) {
  const active = recurring.filter((r) => r.active).slice(0, 4);
  return (
    <div className="card">
      <CardHead icon={<CalendarClock size={18} />} title="Prossime scadenze" sub="Abbonamenti e pagamenti periodici" href="/pianifica#ricorrenti" />
      {active.length === 0 ? (
        <Empty text="Aggiungi affitto, bollette e abbonamenti: ti avviso quando scadono." href="/pianifica#ricorrenti" cta="Aggiungi una ricorrente" />
      ) : (
        <div className="plan-list">
          {active.map((r) => {
            const s = dueStatus(r.next_date, today);
            return (
              <div key={r.id} className="plan-item">
                <span className="plan-title">
                  <span className={`scope-chip ${r.scope}`}>{SCOPE_LABEL[r.scope]}</span>
                  <span>{r.name}</span>
                </span>
                <span className="small num">
                  <strong>{formatEur(r.amount)}</strong>
                </span>
                <span className="plan-meta">
                  {dateIt(r.next_date)} {s !== "futura" && <span className={`status-pill ${s}`}>{DUE_LABEL[s]}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GoalsCard({ goals }: { goals: GoalStatus[] }) {
  return (
    <div className="card">
      <CardHead icon={<PiggyBank size={18} />} title="Obiettivi di risparmio" sub="Fondo emergenza, grandi acquisti" href="/pianifica#obiettivi" />
      {goals.length === 0 ? (
        <Empty text="Crea un obiettivo, ad esempio un fondo d'emergenza o le tasse dell'anno." href="/pianifica#obiettivi" cta="Crea un obiettivo" />
      ) : (
        <div className="plan-list">
          {goals.slice(0, 3).map((g) => (
            <div key={g.id} className="plan-item">
              <span className="plan-title">
                <span>{g.name}</span>
              </span>
              <span className="small num">
                <strong>{formatEur(g.saved)}</strong> <span className="muted">/ {formatEur(g.target)}</span>
              </span>
              <div className="meter" aria-hidden>
                <i style={{ width: `${g.progress * 100}%`, background: "var(--c-profit)" }} />
              </div>
              <span className="plan-meta" style={{ gridColumn: "1 / -1" }}>
                {pct(g.progress)}
                {g.perMonth ? ` · ${formatEur(g.perMonth)} al mese per arrivarci` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
