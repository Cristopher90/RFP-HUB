"use client";

import { useState } from "react";
import { BarChart, type BarChartDatum } from "@/components/BarChart";
import { formatCurrency } from "@/lib/format";

type SupplierTotal = BarChartDatum & { supplierId: string };

type ItemChartData = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  bars: BarChartDatum[];
};

export function ComparisonCharts({
  totals,
  items,
}: {
  totals: SupplierTotal[];
  items: ItemChartData[];
}) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const [itemQuery, setItemQuery] = useState("");

  const q = itemQuery.trim().toLowerCase();
  const filteredItems = q
    ? items.filter((i) => i.name.toLowerCase().includes(q))
    : items;
  const effectiveSelectedId = filteredItems.some((i) => i.id === selectedItemId)
    ? selectedItemId
    : (filteredItems[0]?.id ?? "");
  const selectedItem =
    items.find((i) => i.id === effectiveSelectedId) ?? items[0];

  const bestTotalId =
    totals.length > 0
      ? totals.reduce((min, d) => (d.value < min.value ? d : min), totals[0])
          .id
      : null;

  const bestItemId =
    selectedItem && selectedItem.bars.length > 0
      ? selectedItem.bars.reduce((min, d) => (d.value < min.value ? d : min))
          .id
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Total de la oferta por proveedor
        </h3>
        <p className="mb-4 text-xs text-slate-400">
          Suma de precio unitario × cantidad de todos los artículos.
        </p>
        <BarChart
          data={totals}
          valueFormatter={formatCurrency}
          bestId={bestTotalId}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Precio por artículo
          </h3>
        </div>
        <div className="mb-4 space-y-2">
          <input
            type="text"
            placeholder="Buscar artículo por nombre..."
            value={itemQuery}
            onChange={(e) => setItemQuery(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <select
            value={effectiveSelectedId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {filteredItems.length === 0 ? (
              <option value="">Sin resultados</option>
            ) : (
              filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </div>
        {selectedItem && (
          <BarChart
            data={selectedItem.bars}
            valueFormatter={formatCurrency}
            bestId={bestItemId}
            emptyMessage="Ningún proveedor ha cotizado este artículo."
          />
        )}
      </div>
    </div>
  );
}
