import { Dashboard } from "@/components/Dashboard";
import { fetchSettings, fetchTransactions } from "@/lib/data";
import { dataRange, isIsoDate, PERIODS, summarize, todayRome, type Period } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ p?: string; d?: string }> }) {
  const sp = await searchParams;
  const period: Period = (PERIODS as string[]).includes(sp.p ?? "") ? (sp.p as Period) : "mese";
  const today = todayRome();
  const ref = sp.d && isIsoDate(sp.d) ? sp.d : today;

  const supabase = await createClient();
  const [txs, settings] = await Promise.all([fetchTransactions(supabase, dataRange(period, ref)), fetchSettings(supabase)]);
  const summary = summarize(txs, period, ref, settings);
  const periodTxs = txs.filter((t) => t.date >= summary.range.start && t.date <= summary.range.end);

  return <Dashboard summary={summary} transactions={periodTxs} today={today} refDate={ref} settings={settings} />;
}
