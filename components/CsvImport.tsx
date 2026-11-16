"use client";

import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useState, useTransition } from "react";
import { importTransactions } from "@/app/actions";
import { formatEur, parseCsv, type ParseResult } from "@/lib/finance";
import type { Regime } from "@/lib/ordinario";

async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // Molte banche italiane esportano in Windows-1252: se UTF-8 fallisce, riprovo.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export function CsvImport({ onDone, regime = "forfettario" }: { onDone?: () => void; regime?: Regime }) {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [drag, setDrag] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function load(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    setFileName(file.name);
    setResult(parseCsv(await readText(file)));
  }

  function onImport() {
    if (!result?.rows.length) return;
    start(async () => {
      const r = await importTransactions(result.rows);
      setMessage({ ok: !!r.ok, text: r.message ?? "" });
      if (r.ok) {
        setResult(null);
        setFileName("");
        if (r.inserted) setTimeout(() => onDone?.(), 1200);
      }
    });
  }

  const totIn = result?.rows.filter((r) => r.kind === "entrata").reduce((s, r) => s + r.amount, 0) ?? 0;
  const totOut = result?.rows.filter((r) => r.kind === "uscita").reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <label
        className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          load(e.dataTransfer.files[0]);
        }}
      >
        <input type="file" accept=".csv,text/csv" onChange={(e) => load(e.target.files?.[0])} />
        {fileName ? <FileSpreadsheet size={28} /> : <UploadCloud size={28} />}
        <strong style={{ color: "var(--fg)" }}>{fileName || "Trascina qui il CSV della banca"}</strong>
        <span className="small">{fileName ? "Tocca per scegliere un altro file" : "oppure tocca per sceglierlo"}</span>
      </label>

      {!result && (
        <p className="small muted">
          Riconosco le colonne <code>data</code>, <code>descrizione</code> e <code>importo</code> (negativo = uscita), oppure{" "}
          <code>entrate</code>/<code>uscite</code>, più <code>categoria</code>. I movimenti già presenti vengono saltati.
          {regime === "ordinario" && " Il CSV non indica l'IVA: uso l'aliquota tipica di ogni categoria (22% per fatture e acquisti, esente per la banca)."}
        </p>
      )}

      {result && result.rows.length > 0 && (
        <>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="card kcard kind-in" style={{ padding: "12px 14px" }}>
              <span className="ktag">Entrate</span>
              <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>{formatEur(totIn)}</div>
            </div>
            <div className="card kcard kind-out" style={{ padding: "12px 14px" }}>
              <span className="ktag">Uscite</span>
              <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>{formatEur(totOut)}</div>
            </div>
          </div>
          <table className="preview-table">
            <tbody>
              {result.rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  <td className="nowrap muted">{r.date.split("-").reverse().join("/")}</td>
                  <td className="ellipsis">{r.description || r.category}</td>
                  <td className="right nowrap num" style={{ fontWeight: 600 }}>
                    <span className={`dot ${r.kind === "entrata" ? "dot-in" : "dot-out"}`} style={{ marginRight: 6 }} />
                    {r.kind === "uscita" ? "−" : "+"}
                    {formatEur(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > 5 && <p className="small muted">…e altri {result.rows.length - 5} movimenti.</p>}
          <button className="btn btn-primary btn-block" onClick={onImport} disabled={pending} style={{ padding: "14px 16px" }}>
            {pending ? "Import in corso…" : `Importa ${result.rows.length} movimenti`}
          </button>
        </>
      )}

      {result && result.errors.length > 0 && (
        <details className="alert alert-warn" open={result.rows.length === 0}>
          <summary>{result.errors.length === 1 ? "1 riga con problemi" : `${result.errors.length} righe con problemi`}</summary>
          <ul className="small">
            {result.errors.slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
      {message && <p className={`alert ${message.ok ? "alert-ok" : "alert-error"}`}>{message.text}</p>}
    </div>
  );
}
