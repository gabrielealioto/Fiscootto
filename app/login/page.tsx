import { BarChart3, FileSpreadsheet, PiggyBank, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="auth">
      <section className="auth-hero">
        <Logo />
        <div className="stack" style={{ gap: 18 }}>
          <span className="pill">
            <Sparkles size={14} /> Per freelance in regime forfettario
          </span>
          <h1>
            Il controller finanziario del tuo <em>forfettario</em>.
          </h1>
          <p className="lead" style={{ marginTop: 0 }}>
            Entrate, uscite, profitti e tasse da accantonare, sempre chiari. Con un report che ti dice cosa fare.
          </p>
          <div className="stats">
            <div>
              <strong>
                <BarChart3 size={18} /> 4
              </strong>
              <span>voci sempre chiare</span>
            </div>
            <div>
              <strong>
                <Sparkles size={18} /> 1 clic
              </strong>
              <span>per il report</span>
            </div>
            <div>
              <strong>
                <Wallet size={18} /> 0 €
              </strong>
              <span>per iniziare</span>
            </div>
          </div>
        </div>
        <ul className="features">
          <li>
            <span className="fi">
              <PiggyBank size={19} />
            </span>
            <span>
              <strong>Quanto accantonare</strong>
              Contributi e imposta stimati sul tuo coefficiente ATECO.
            </span>
          </li>
          <li>
            <span className="fi">
              <FileSpreadsheet size={19} />
            </span>
            <span>
              <strong>Import dalla banca</strong>
              Carichi il CSV e i movimenti sono dentro, senza doppioni.
            </span>
          </li>
          <li>
            <span className="fi">
              <Sparkles size={19} />
            </span>
            <span>
              <strong>Report del periodo</strong>
              Giorno, settimana o mese: cosa è cambiato e cosa fare.
            </span>
          </li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div>
            <h2>Accedi a Fiscootto</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Inserisci la tua email: ti mandiamo un link per entrare. Nessuna password da ricordare.
            </p>
          </div>
          {error && <p className="alert alert-error">Accesso non riuscito: {error}</p>}
          <div className="auth-form">
            <LoginForm />
          </div>
          <p className="auth-foot row" style={{ justifyContent: "center", gap: 6 }}>
            <ShieldCheck size={14} /> I tuoi dati sono visibili solo a te.
          </p>
        </div>
      </section>
    </div>
  );
}
