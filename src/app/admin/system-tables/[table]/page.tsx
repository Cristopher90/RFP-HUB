import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireClientScope } from "@/lib/clientScope";
import { prisma } from "@/lib/prisma";
import { findSystemTable, formatCellValue } from "@/lib/systemTables";
import { getTableMeta } from "@/lib/systemTablesMeta";
import { getDictionary } from "@/i18n/getDictionary";
import { SystemTableGrid, type GridRow } from "./SystemTableGrid";

const MAX_ROWS = 300;

// Raw table browser and editor (Super Administrador only). `?filter=col:value`
// narrows the rows to one relation (e.g. the children of a row).
export default async function SystemTablePage({
  params,
  searchParams,
}: PageProps<"/admin/system-tables/[table]">) {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const dictionary = getDictionary(scope.user.language);

  const { table: tableKey } = await params;
  const sp = await searchParams;
  const table = findSystemTable(tableKey);
  if (!table) notFound();
  const meta = await getTableMeta(table.label);

  const filterRaw = typeof sp.filter === "string" ? sp.filter : "";
  const sep = filterRaw.indexOf(":");
  const filterColumn = sep > 0 ? filterRaw.slice(0, sep) : "";
  const filterValue = sep > 0 ? filterRaw.slice(sep + 1) : "";
  const filter = meta.columns.some((c) => c.name === filterColumn) ? { column: filterColumn, value: filterValue } : null;

  const where = filter ? `WHERE "${filter.column}"::text = $1` : "";
  const args = filter ? [filter.value] : [];
  const [rawRows, totalResult] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${meta.table}" ${where} LIMIT ${MAX_ROWS}`,
      ...args,
    ),
    prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${meta.table}" ${where}`, ...args),
  ]);
  const total = Number(totalResult[0]?.n ?? 0);

  const toEdit = (value: unknown, kind: string): string | null => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.join(",");
    if (kind === "json") return JSON.stringify(value, null, 2);
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const editable = !meta.immutable && meta.pk !== null;
  const rows: GridRow[] = rawRows.map((row, i) => ({
    id: meta.pk ? String(row[meta.pk]) : String(i),
    shown: Object.fromEntries(meta.columns.map((c) => [c.name, formatCellValue(row[c.name], dictionary.common)])),
    edit: Object.fromEntries(meta.columns.map((c) => [c.name, toEdit(row[c.name], c.kind)])),
  }));

  const d = dictionary.systemTablePage;
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link href="/admin/system-tables" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToList}
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{table.label}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? d.rowSingular : d.rowPlural}
            {total > rows.length ? ` ${d.showingFirst} ${rows.length}` : ""}.{" "}
            {meta.immutable && <span className="font-medium text-amber-700">{dictionary.systemTableEditor.readOnlyTable}</span>}
            {!meta.immutable && !meta.pk && (
              <span className="font-medium text-amber-700">{dictionary.systemTableEditor.noSimpleKey}</span>
            )}
          </p>
        </div>
        <Link
          href={`/admin/system-tables/log?table=${table.label}`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {dictionary.systemTableEditor.viewLog}
        </Link>
      </div>
      {filter && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-800">
          {dictionary.systemTableEditor.filteredBy} <code>{filter.column} = {filter.value}</code>
          <Link href={`/admin/system-tables/${tableKey}`} className="font-medium underline">
            {dictionary.systemTableEditor.clearFilter}
          </Link>
        </p>
      )}
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">{d.emptyTable}</p>
        ) : (
          <SystemTableGrid
            tableKey={tableKey}
            editable={editable}
            columns={meta.columns.map((c) => ({
              name: c.name,
              kind: c.kind,
              nullable: c.nullable,
              enumValues: c.enumValues,
              editable: c.editable,
            }))}
            rows={rows}
          />
        )}
      </div>
    </div>
  );
}
