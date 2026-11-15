import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login">
      <div className="card login-card">
        <h1>Accedi a Fiscootto</h1>
        <p className="muted">
          Inserisci la tua email: ti mandiamo un link per entrare. Nessuna password da ricordare.
        </p>
        {error && <p className="alert alert-error">Accesso non riuscito: {error}</p>}
        <LoginForm />
      </div>
    </div>
  );
}
