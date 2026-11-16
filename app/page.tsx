import { Dashboard } from "@/components/Dashboard";
import { customDeducibility, fetchPlanning, fetchSettings, fetchTransactions } from "@/lib/data";
import { dataRange, isIsoDate, PERIODS, summarize, todayRome, type Period } from "@/lib/finance";
import { budgetStatuses, buildAlerts, goalStatus, inView, VIEWS, type View } from "@/lib/planning";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ p?: string; d?: string; v?: string }> }) {
  const sp = await searchParams;
  const period: Period = (PERIODS as string[]).includes(sp.p ?? "") ? (sp.p as Period) : "mese";
  const view: View = (VIEWS as string[]).includes(sp.v ?? "") ? (sp.v as View) : "work";
  const today = todayRome();
  const ref = sp.d && isIsoDate(sp.d) ? sp.d : today;

  const supabase = await createClient();
  const [txs, baseSettings, planning] = await Promise.all([
    fetchTransactions(supabase, dataRange(period, ref)),
    fetchSettings(supabase),
    fetchPlanning(supabase),
  ]);
  const settings = { ...baseSettings, deducibilita: customDeducibility(planning.categories) };
  const summary = summarize(txs, period, ref, settings, 6, view);
  const periodTxs = txs.filter((t) => t.date >= summary.range.start && t.date <= summary.range.end && inView(t, view));

  // Budget del mese del periodo mostrato; scadenze e obiettivi rispetto a oggi.
  const budgets = budgetStatuses(planning.budgets, txs, ref);
  const goals = planning.goals.map((g) => goalStatus(g, today));
  const alerts = buildAlerts(budgets, planning.recurring, goals, today);

  return (
    <Dashboard
      summary={summary}
      transactions={periodTxs}
      today={today}
      refDate={ref}
      settings={settings}
      aiEnabled={!!process.env.ANTHROPIC_API_KEY}
      receiptEnabled={!!process.env.ANTHROPIC_API_KEY}
      view={view}
      budgets={budgets}
      recurring={planning.recurring}
      goals={goals}
      alerts={alerts}
    />
  );
}
