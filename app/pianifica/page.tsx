import { CalendarClock, PiggyBank, Target } from "lucide-react";
import { AlertsList } from "@/components/PlanningCards";
import { BudgetSection, GoalsSection, RecurringSection } from "@/components/PlanSections";
import { customDeducibility, fetchPlanning, fetchSettings, fetchTransactions } from "@/lib/data";
import { dataRange, formatEur, summarize, todayRome } from "@/lib/finance";
import { budgetStatuses, buildAlerts, goalStatus, monthlyEquivalent } from "@/lib/planning";
import { createClient } from "@/lib/supabase/server";

export default async function PianificaPage() {
  const today = todayRome();
  const supabase = await createClient();
  const [txs, baseSettings, planning] = await Promise.all([
    fetchTransactions(supabase, dataRange("mese", today)),
    fetchSettings(supabase),
    fetchPlanning(supabase),
  ]);
  const settings = { ...baseSettings, deducibilita: customDeducibility(planning.categories) };
  const budgets = budgetStatuses(planning.budgets, txs, today);
  const goals = planning.goals.map((g) => goalStatus(g, today));
  const alerts = buildAlerts(budgets, planning.recurring, goals, today);
  const summary = summarize(txs, "mese", today, settings, 1, "work");

  const active = planning.recurring.filter((r) => r.active && r.kind === "uscita");
  const fixedMonthly = active.reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0);
  const fixedWork = active.filter((r) => r.scope === "work").reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0);
  const saved = goals.reduce((s, g) => s + g.saved, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const budgetTotal = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const budgetSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="stack-lg" style={{ maxWidth: 1080 }}>
      <header className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Budget, scadenze e risparmi</div>
          <h1 className="page-title">Pianifica</h1>
        </div>
      </header>

      <section className="grid grid-3">
        <div className="card tile">
          <span className="tile-label">
            <span className="card-icon">
              <Target size={18} />
            </span>
            Budget del mese
          </span>
          <div className="tile-value">{budgets.length ? formatEur(budgetSpent) : "—"}</div>
          <div className="tile-sub">{budgets.length ? `spesi su ${formatEur(budgetTotal)} di tetti` : "Nessun budget impostato"}</div>
        </div>
        <div className="card tile">
          <span className="tile-label">
            <span className="card-icon">
              <CalendarClock size={18} />
            </span>
            Spese fisse al mese
          </span>
          <div className="tile-value">{formatEur(fixedMonthly)}</div>
          <div className="tile-sub">
            Work {formatEur(fixedWork)} · Life {formatEur(fixedMonthly - fixedWork)}
          </div>
        </div>
        <div className="card tile full-sm">
          <span className="tile-label">
            <span className="card-icon">
              <PiggyBank size={18} />
            </span>
            Messi da parte
          </span>
          <div className="tile-value">{formatEur(saved)}</div>
          <div className="tile-sub">{goals.length ? `su ${formatEur(target)} di obiettivi` : "Nessun obiettivo"}</div>
        </div>
      </section>

      <AlertsList alerts={alerts} max={10} />

      <section id="budget" className="stack">
        <div>
          <h2 style={{ fontSize: "1.2rem" }}>Budget mensili</h2>
          <p className="small muted">Un tetto di spesa al mese per categoria, Work o Life.</p>
        </div>
        <BudgetSection budgets={budgets} categories={planning.categories} />
      </section>

      <section id="ricorrenti" className="stack">
        <div>
          <h2 style={{ fontSize: "1.2rem" }}>Spese e incassi ricorrenti</h2>
          <p className="small muted">Abbonamenti, bollette, affitto: quando li paghi premi &quot;Pagata&quot; e registro il movimento.</p>
        </div>
        <RecurringSection recurring={planning.recurring} categories={planning.categories} regime={settings.regime ?? "forfettario"} today={today} />
      </section>

      <section id="obiettivi" className="stack">
        <div>
          <h2 style={{ fontSize: "1.2rem" }}>Obiettivi di risparmio</h2>
          <p className="small muted">Spazi per accantonare: fondo d&apos;emergenza, tasse, grandi acquisti.</p>
        </div>
        <GoalsSection goals={goals} taxYtd={summary.taxYtd.totale} />
      </section>
    </div>
  );
}
