"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CopyRfpButton({ rfpId }: { rfpId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        Copiar
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={() => router.push(`/rfps/new?copyFrom=${rfpId}&mode=blank`)}
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="block font-medium text-slate-800">
                Empezar desde cero
              </span>
              <span className="block text-xs text-slate-400">
                Copia artículos y preguntas, sin precios históricos.
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/rfps/new?copyFrom=${rfpId}&mode=based_on`)
              }
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="block font-medium text-slate-800">
                Usar como proceso anterior
              </span>
              <span className="block text-xs text-slate-400">
                Trae el precio ganador de cada artículo como precio
                histórico y enlaza esta RFP como antecesora.
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
