"use client";

import { NUMBER_REFERENCE_KEY, type ScoringConfig } from "@/lib/questionScoring";

function smallInputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Lets the buyer configure, per question, how a supplier's answer converts
// automatically into a score — instead of assigning it by hand later in
// Comparar propuestas. Only meaningful for SUPPLIER-answered SELECT/NUMBER/
// YES_NO questions; renders nothing for any other type.
export function QuestionScoringFields({
  type,
  options,
  scoringConfig,
  onChange,
}: {
  type: string;
  options: string[];
  scoringConfig: ScoringConfig | null;
  onChange: (config: ScoringConfig | null) => void;
}) {
  const config = scoringConfig ?? {};

  function setValue(key: string, raw: string) {
    const next = { ...config };
    if (raw === "") {
      delete next[key];
    } else {
      next[key] = Number(raw);
    }
    onChange(Object.keys(next).length > 0 ? next : null);
  }

  if (type === "SELECT") {
    const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (cleanOptions.length === 0) return null;
    return (
      <div className="sm:col-span-12">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Puntaje automático por respuesta (% de la puntuación)
        </label>
        <div className="flex flex-wrap gap-2">
          {cleanOptions.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
            >
              <span className="text-xs text-slate-600">{opt}</span>
              <input
                type="number"
                min={0}
                max={100}
                className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                value={config[opt] ?? ""}
                onChange={(e) => setValue(opt, e.target.value)}
              />
              <span className="text-xs text-slate-400">%</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (type === "YES_NO") {
    return (
      <div className="flex gap-3 sm:col-span-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            &quot;Sí&quot; vale (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            className={smallInputClass()}
            value={config["Sí"] ?? ""}
            onChange={(e) => setValue("Sí", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            &quot;No&quot; vale (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            className={smallInputClass()}
            value={config["No"] ?? ""}
            onChange={(e) => setValue("No", e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (type === "NUMBER") {
    return (
      <div className="sm:col-span-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Valor que equivale al 100%
        </label>
        <input
          type="number"
          step="any"
          className={smallInputClass()}
          value={config[NUMBER_REFERENCE_KEY] ?? ""}
          onChange={(e) => setValue(NUMBER_REFERENCE_KEY, e.target.value)}
        />
      </div>
    );
  }

  return null;
}
