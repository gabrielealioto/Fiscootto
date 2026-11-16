"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteReport } from "@/app/actions";

export function DeleteReportButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() => {
        if (confirm("Eliminare questo report?")) start(() => deleteReport(id));
      }}
    >
      <Trash2 size={15} /> Elimina
    </button>
  );
}
