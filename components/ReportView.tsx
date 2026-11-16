"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { Markdown } from "./Markdown";

export function ReportView({ content, filename }: { content: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="report">
      <div className="report-actions">
        <button className="btn btn-ghost btn-sm" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiato" : "Copia"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={download}>
          <Download size={15} /> Scarica .md
        </button>
      </div>
      <Markdown text={content} />
    </div>
  );
}
