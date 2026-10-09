import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { SYSTEM_TABLES, groupOfTable } from "@/lib/systemTables";
import { allForeignKeys } from "@/lib/systemTablesMeta";
import { RelationsTableSelect } from "./RelationsTableSelect";

const RULE_STYLE: Record<string, string> = {
  cascade: "bg-red-100 text-red-700",
  setnull: "bg-amber-100 text-amber-700",
  restrict: "bg-slate-200 text-slate-700",
  default: "bg-amber-100 text-amber-700",
};

// Direct relationships (foreign keys) between the tables, with what happens to
// the dependent rows when a row is deleted.
export default async function SystemTableRelationsPage({
  searchParams,
}: PageProps<"/admin/system-tables/relations">) {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const dictionary = getDictionary(scope.user.language);
  const d = dictionary.systemTableRelations;
  const rule = dictionary.systemTableEditor;

  const sp = await searchParams;
  const labels = SYSTEM_TABLES.map((t) => t.label as string);
  const selected = typeof sp.table === "string" && labels.includes(sp.table) ? sp.table : "";

  const keyOf = (label: string) => SYSTEM_TABLES.find((t) => t.label === label)?.key;
  const edges = (await allForeignKeys()).filter(
    (e) => labels.includes(e.childTable) && labels.includes(e.parentTable),
  );
  const shown = selected ? edges.filter((e) => e.parentTable === selected || e.childTable === selected) : edges;
  const parents = edges.filter((e) => e.childTable === selected); // tables this one points to
  const children = edges.filter((e) => e.parentTable === selected); // tables that point to this one
  const ruleLabel = (r: string) => rule[`rule_${r}` as keyof typeof rule] as string;

  const box = (label: string, note: string, extra?: React.ReactNode) => (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <Link
        href={`/admin/system-tables/relations?table=${label}`}
        className="font-semibold text-slate-800 hover:text-violet-700"
      >
        {label}
      </Link>
      <p className="text-xs text-slate-500">{note}</p>
      {extra}
      {keyOf(label) && (
        <Link href={`/admin/system-tables/${keyOf(label)}`} className="mt-1 inline-block text-xs text-violet-600 hover:text-violet-700">
          {d.viewData} →
        </Link>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/admin/system-tables" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToTables}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>

      <div className="mt-6">
        <RelationsTableSelect tables={labels} />
      </div>

      {selected && (
        <div className="mt-6 grid grid-cols-1 items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{d.pointsTo}</p>
            {parents.length === 0 && <p className="text-xs text-slate-400">{d.none}</p>}
            {parents.map((e) => (
              <div key={`${e.parentTable}${e.childColumn}`}>
                {box(e.parentTable, `${d.viaField}: ${e.childColumn}`)}
              </div>
            ))}
          </div>
          <span className="hidden text-2xl text-slate-300 lg:block">←</span>
          <div className="rounded-xl border-2 border-violet-400 bg-white px-4 py-4 text-center shadow">
            <p className="text-lg font-semibold text-slate-900">{selected}</p>
            <p className="text-xs text-slate-500">{d.group[groupOfTable(selected) as keyof typeof d.group] ?? ""}</p>
          </div>
          <span className="hidden text-2xl text-slate-300 lg:block">←</span>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{d.usedBy}</p>
            {children.length === 0 && <p className="text-xs text-slate-400">{d.none}</p>}
            {children.map((e) => (
              <div key={`${e.childTable}${e.childColumn}`}>
                {box(
                  e.childTable,
                  `${d.viaField}: ${e.childColumn}`,
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${RULE_STYLE[e.rule]}`}>
                    {ruleLabel(e.rule)}
                  </span>,
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{d.parentTable}</th>
              <th className="px-4 py-3">{d.childTable}</th>
              <th className="px-4 py-3">{d.field}</th>
              <th className="px-4 py-3">{d.onDelete}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {d.none}
                </td>
              </tr>
            )}
            {[...shown]
              .sort((a, b) => a.parentTable.localeCompare(b.parentTable) || a.childTable.localeCompare(b.childTable))
              .map((e) => (
                <tr key={`${e.childTable}.${e.childColumn}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <Link href={`/admin/system-tables/relations?table=${e.parentTable}`} className="hover:text-violet-700">
                      {e.parentTable}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    <Link href={`/admin/system-tables/relations?table=${e.childTable}`} className="hover:text-violet-700">
                      {e.childTable}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <code>{e.childColumn}</code> → <code>{e.parentColumn}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RULE_STYLE[e.rule]}`}>
                      {ruleLabel(e.rule)}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">{d.footnote}</p>
    </div>
  );
}
