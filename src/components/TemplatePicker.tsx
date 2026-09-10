"use client";

import { useState } from "react";

export type PickableTemplate = {
  id: string;
  name: string;
  description: string | null;
};

// Same popup pattern as TreePickerField/SupplierSearchPicker: a trigger
// button that opens a centered modal listing the candidate templates (the
// ones whose condición — commodity/región/precio — currently matches the
// RFP), each with its descripción so the buyer can tell what it's for
// before picking. Disabled when there's nothing to choose from.
export function TemplatePicker({
  templates,
  selectedId,
  onChange,
}: {
  templates: PickableTemplate[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  if (templates.length === 0) {
    return (
      <input
        disabled
        readOnly
        value="Ninguna plantilla específica aplica"
        className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm"
      />
    );
  }

  function selectAndClose(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>
          {selected ? selected.name : "Selecciona una plantilla"}
        </span>
        <span aria-hidden className="ml-2 text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700">
                Plantillas que coinciden
              </p>
              <button
                type="button"
                onClick={() => selectAndClose(null)}
                className="shrink-0 text-sm font-medium whitespace-nowrap text-violet-600 hover:text-violet-700"
              >
                — Ninguna —
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {templates.map((t) => {
                const isSelected = t.id === selectedId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectAndClose(t.id)}
                    className={`block w-full rounded-md px-3 py-2 text-left hover:bg-violet-50 ${
                      isSelected ? "bg-violet-50" : ""
                    }`}
                  >
                    <span
                      className={`block text-sm font-medium ${
                        isSelected ? "text-violet-700" : "text-slate-800"
                      }`}
                    >
                      {t.name}
                    </span>
                    {t.description && (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {t.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
