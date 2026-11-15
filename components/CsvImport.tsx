"use client";

import { useState, useTransition } from "react";
import { importTransactions } from "@/app/actions";
import { formatEur, parseCsv, type ParseResult } from "@/lib/finance";

export function CsvImport() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMessage(null);
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    // Molte banche italiane esportano in Windows-1252: se UTF-8 fallisce, riprovo.
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      text = new TextDecoder("windows-1252").decode(buf);
    }
    setResult(parseCsv(text));
  }

  function onImport() {
    if (!result?.rows.length) return;
    start(async () => {
      const r = await importTransactions(result.rows);
      setMessage({ ok: !!r.ok, text: r.message ?? "" });
      if (r.ok) setResult(null);
    });
  }

  const totIn = result?.rows.filter((r) => r.kind === "entrata").reduce((s, r) => s + r.amount, 0) ?? 0;
  const totOut = result?.rows.filter((r) => r.kind === "uscita").reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div className="stack">
      <p className="muted small">
        Colonne riconosciute: <code>data</code>, <code>descrizione</code>, <code>importo</code> (negativo = uscita) oppure{" "}
        <code>entrate</code>/<code>uscite</code>, e <code>categoria</code>. Separatore <code>;</code> o <code>,</code>. I movimenti già
        presenti vengono saltati.
      </p>
      <label className="file">
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        <span className="btn btn-ghost">{fileName || "Scegli file CSV…"}</span>
      </label>

      {result && (
        <div className="stack">
          {result.rows.length > 0 && (
            <>
              <p>
                <strong>{result.rows.length}</strong> movimenti trovati: entrate {formatEur(totIn)}, uscite {formatEur(totOut)}.
              </p>
              <div className="table-wrap">
                <table className="table small">
                  <tbody>
                    {result.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="nowrap">{r.date.split("-").reverse().join("/")}</td>
                        <td className="ellipsis">{r.description}</td>
                        <td className={`num ${r.kind === "entrata" ? "pos" : "neg"}`}>
                          {r.kind === "uscita" ? "−" : ""}
                          {formatEur(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.rows.length > 5 && <p className="muted small">…e altri {result.rows.length - 5}.</p>}
              <button className="btn btn-primary" onClick={onImport} disabled={pending}>
                {pending ? "Import in corso…" : `Importa ${result.rows.length} movimenti`}
              </button>
            </>
          )}
          {result.errors.length > 0 && (
            <details className="alert alert-error" open={result.rows.length === 0}>
              <summary>{result.errors.length === 1 ? "1 riga con problemi" : `${result.errors.length} righe con problemi`}</summary>
              <ul className="small">
                {result.errors.slice(0, 20).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {message && <p className={`alert ${message.ok ? "alert-ok" : "alert-error"}`}>{message.text}</p>}
    </div>
  );
}
