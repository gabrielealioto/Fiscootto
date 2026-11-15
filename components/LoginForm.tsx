"use client";

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
      <p className="alert alert-ok">
        Controlla la posta: abbiamo inviato il link a <strong>{email}</strong>. Aprilo da questo dispositivo.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack">
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
      <button className="btn btn-primary" disabled={status === "sending"}>
        {status === "sending" ? "Invio in corso…" : "Inviami il link"}
      </button>
      {status === "error" && <p className="alert alert-error">{message}</p>}
    </form>
  );
}
