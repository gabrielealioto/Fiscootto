"use client";

import { ArrowRight, LoaderCircle, MailCheck } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="card sent">
        <span className="sent-icon">
          <MailCheck size={28} />
        </span>
        <h2 style={{ fontSize: "1.15rem" }}>Controlla la posta</h2>
        <p className="muted">
          Abbiamo inviato il link a <strong style={{ color: "var(--fg)" }}>{email}</strong>. Aprilo con questo stesso browser.
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => setStatus("idle")}>
          Usa un'altra email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@esempio.it"
        />
      </label>
      <button className="btn btn-primary btn-block" disabled={status === "sending"} style={{ padding: "14px 16px" }}>
        {status === "sending" ? <LoaderCircle size={18} className="spin" /> : null}
        {status === "sending" ? "Invio in corso…" : "Inviami il link"}
        {status !== "sending" && <ArrowRight size={18} />}
      </button>
      {status === "error" && <p className="alert alert-error">{message}</p>}
    </form>
  );
}
