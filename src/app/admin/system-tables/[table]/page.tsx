import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireClientScope } from "@/lib/clientScope";
import {
  findSystemTable,
  loadSystemTableRows,
  formatCellValue,
} from "@/lib/systemTables";

export default async function SystemTablePage({
  params,
}: PageProps<"/admin/system-tables/[table]">) {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");

  const { table: tableKey } = await params;
  const table = findSystemTable(tableKey);
  if (!table) notFound();

  const { rows, columns, total, truncated } = await loadSystemTableRows(table);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link
        href="/admin/system-tables"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Tablas del sistema
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {table.label}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {total} fila{total === 1 ? "" : "s"} en total
        {truncated ? ` — mostrando las primeras ${rows.length}` : ""}.
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Esta tabla está vacía.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-medium uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {columns.map((c) => {
                    const value = formatCellValue(row[c]);
                    return (
                      <td
                        key={c}
                        title={value}
                        className="max-w-xs truncate px-3 py-2 text-slate-600"
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
