"use client";

import { useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type PickableTemplate = {
  id: string;
  name: string;
  description: string | null;
  priority?: number;
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
  locked = false,
  general = [],
}: {
  // Templates without any condition: they apply to every RFP, so they are not
  // chosen here, but the buyer should see that they are in effect.
  general?: { id: string; name: string }[];
  locked?: boolean; // an absolute template is imposed: nothing to choose
  templates: PickableTemplate[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const generalNames = general.map((g) => g.name).join(", ");
  const generalHint =
    general.length > 0 ? (
      <p className="mt-1 text-xs text-slate-500">{t("rfpForm.generalTemplatesApply").replace("{names}", generalNames)}</p>
    ) : null;

  if (templates.length === 0) {
    return (
      <div>
        <input
          disabled
          readOnly
          value={general.length > 0 ? generalNames : t("rfpForm.noSpecificTemplate")}
          className={`w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm shadow-sm ${
            general.length > 0 ? "text-slate-700" : "text-slate-500"
          }`}
        />
        {general.length > 0 && <p className="mt-1 text-xs text-slate-500">{t("rfpForm.generalTemplateOnly")}</p>}
      </div>
    );
  }

  function selectAndClose(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  if (locked) {
    return (
      <div>
        <div className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm">
          <span>{selected ? selected.name : "—"}</span>
          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            🔒 Plantilla obligatoria
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Esta plantilla se aplica siempre que coincide y no se puede cambiar.
        </p>
        {generalHint}
      </div>
    );
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
      {generalHint}

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
              <span className="text-xs text-slate-400">Se aplica por defecto la de menor prioridad</span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {templates.map((t, index) => {
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
                      {t.priority !== undefined && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          Prioridad {t.priority}
                        </span>
                      )}
                      {index === 0 && templates.length > 1 && (
                        <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                          Por defecto
                        </span>
                      )}
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
