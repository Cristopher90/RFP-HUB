"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type SupplierCol = { id: string; name: string; company: string; color: string };

type ItemRow = {
  id: string;
  code: string | null;
  name: string;
  quantity: number;
  unit: string;
  historicalPrice: number | null;
  bestCurrentPrice: number | null;
  prices: { invId: string; price: number | undefined }[];
};

export function ItemPriceTable({
  suppliers,
  items,
  totals,
  bestTotal,
}: {
  suppliers: SupplierCol[];
  items: ItemRow[];
  totals: { invId: string; total: number }[];
  bestTotal: number | null;
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filteredItems = q
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.code ?? "").toLowerCase().includes(q),
      )
    : items;

  return (
    <div>
      {items.length > 6 && (
        <input
          type="text"
          placeholder="Buscar artículo por nombre o código..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-5 py-3">Artículo</th>
              <th className="px-5 py-3 whitespace-nowrap">Precio histórico</th>
              <th className="px-5 py-3 whitespace-nowrap">Ahorro</th>
              {suppliers.map((s) => (
                <th key={s.id} className="px-5 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    {s.name}
                  </span>
                  <p className="font-normal normal-case text-slate-400">
                    {s.company}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + suppliers.length}
                  className="px-5 py-6 text-center text-slate-400"
                >
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const min = Math.min(
                  ...item.prices
                    .map((p) => p.price)
                    .filter((p): p is number => p !== undefined),
                );
                const savings =
                  item.historicalPrice != null && item.bestCurrentPrice != null
                    ? item.historicalPrice - item.bestCurrentPrice
                    : null;
                return (
                  <tr key={item.id}>
                    <td className="sticky left-0 bg-white px-5 py-3 font-medium text-slate-800">
                      {item.code && (
                        <span className="mr-1.5 text-xs font-normal text-slate-400">
                          {item.code}
                        </span>
                      )}
                      {item.name}
                      <p className="text-xs font-normal text-slate-400">
                        {item.quantity} {item.unit}
                      </p>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                      {item.historicalPrice != null
                        ? formatCurrency(item.historicalPrice)
                        : "—"}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {savings === null ? (
                        <span className="text-slate-400">—</span>
                      ) : savings > 0 ? (
                        <span className="font-medium text-emerald-700">
                          {formatCurrency(savings)} ahorro
                        </span>
                      ) : savings < 0 ? (
                        <span className="font-medium text-red-600">
                          {formatCurrency(Math.abs(savings))} más caro
                        </span>
                      ) : (
                        <span className="text-slate-400">sin cambio</span>
                      )}
                    </td>
                    {item.prices.map(({ invId, price }) => (
                      <td
                        key={invId}
                        className={`px-5 py-3 whitespace-nowrap ${
                          price === min
                            ? "font-semibold text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        {price !== undefined ? formatCurrency(price) : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
            <tr className="bg-slate-50">
              <td
                className="sticky left-0 bg-slate-50 px-5 py-3 font-semibold text-slate-900"
                colSpan={3}
              >
                Total estimado
              </td>
              {totals.map(({ invId, total }) => (
                <td
                  key={invId}
                  className={`px-5 py-3 whitespace-nowrap font-semibold ${
                    total === bestTotal ? "text-emerald-700" : "text-slate-800"
                  }`}
                >
                  {formatCurrency(total)}
                  {total === bestTotal && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Mejor precio
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
