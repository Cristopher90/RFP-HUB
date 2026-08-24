"use client";

import { useEffect, useMemo, useState } from "react";
import { searchPreviousRfps, type PreviousRfpResult } from "@/app/rfps/rfpActions";

function selectClass() {
  return "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Search-popup picker for "basar en una RFP anterior" / "Copiar": filters
// by título, commodity, región y creador — same shape as SupplierSearchPicker.
export function PreviousRfpPicker({
  commodities,
  regions,
  creators,
  excludeRfpId,
  onSelect,
  triggerLabel = "Buscar RFP anterior...",
}: {
  commodities: string[];
  regions: string[];
  creators: { id: string; name: string }[];
  excludeRfpId?: string;
  onSelect: (rfp: PreviousRfpResult) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState<PreviousRfpResult[]>([]);
  const [query, setQuery] = useState("");
  const [commodity, setCommodity] = useState("");
  const [region, setRegion] = useState("");
  const [creatorId, setCreatorId] = useState("");

  useEffect(() => {
    if (!open || all.length > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    searchPreviousRfps({ excludeRfpId })
      .then(setAll)
      .finally(() => setLoading(false));
  }, [open, all.length, excludeRfpId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (commodity && r.commodity !== commodity) return false;
      if (region && r.region !== region) return false;
      if (creatorId && r.creatorName !== creators.find((c) => c.id === creatorId)?.name)
        return false;
      return true;
    });
  }, [all, query, commodity, region, creatorId, creators]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm text-slate-400 shadow-sm hover:border-violet-400 hover:bg-slate-50"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2 border-b border-slate-200 p-4">
              <input
                autoFocus
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="Buscar por título..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <select
                  className={selectClass()}
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                >
                  <option value="">Todos los commodities</option>
                  {commodities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass()}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="">Todas las regiones</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass()}
                  value={creatorId}
                  onChange={(e) => setCreatorId(e.target.value)}
                >
                  <option value="">Todos los creadores</option>
                  {creators.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-sm text-slate-400">Buscando...</p>
              ) : results.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Sin resultados.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">RFP</th>
                      <th className="px-4 py-2">Commodity</th>
                      <th className="px-4 py-2">Región</th>
                      <th className="px-4 py-2">Creador</th>
                      <th className="px-4 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => {
                          onSelect(r);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="cursor-pointer hover:bg-violet-50"
                      >
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {r.label}
                          {r.awarded && (
                            <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              adjudicada
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {r.commodity ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {r.region ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {r.creatorName}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
