"use client";

import Link from "next/link";
import { useTransition } from "react";
import { publishRfp, deleteRfpDraft } from "./actions";

export function DraftActions({ rfpId }: { rfpId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Link
        href={`/rfps/${rfpId}/edit`}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        Editar
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await publishRfp(rfpId); })}
        className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
      >
        Publicar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("¿Eliminar este borrador? Los datos se conservan pero dejará de aparecer en los listados."))
            return;
          startTransition(async () => { await deleteRfpDraft(rfpId); });
        }}
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Eliminar borrador
      </button>
    </>
  );
}
