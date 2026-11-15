"use client";

import { useTransition } from "react";
import { deleteReport } from "@/app/actions";

export function DeleteReportButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-ghost btn-sm danger"
      disabled={pending}
      onClick={() => {
        if (confirm("Eliminare questo report?")) start(() => deleteReport(id));
      }}
    >
      Elimina report
    </button>
  );
}
