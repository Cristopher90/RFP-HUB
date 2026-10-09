import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime } from "@/lib/format";
import { SYSTEM_TABLES } from "@/lib/systemTables";
import { SystemLogFilters } from "./SystemLogFilters";

const LIMIT = 200;

type Change = { from: unknown; to: unknown };
const show = (v: unknown) => (v === null || v === undefined ? "NULL" : typeof v === "object" ? JSON.stringify(v) : String(v));

// What the Super Administrador changed or deleted from "Tablas del sistema".
export default async function SystemTableLogPage({ searchParams }: PageProps<"/admin/system-tables/log">) {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const { user } = scope;
  const dictionary = getDictionary(user.language);
  const d = dictionary.systemTableLogPage;
  const dateOptions = { locale: localeForLanguage(user.language), timeZone: user.timezone };

  const sp = await searchParams;
  const table = typeof sp.table === "string" && SYSTEM_TABLES.some((t) => t.label === sp.table) ? sp.table : undefined;
  const action = sp.action === "UPDATE" || sp.action === "DELETE" ? sp.action : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const entries = await prisma.systemTableLog.findMany({
    where: {
      ...(table ? { table } : {}),
      ...(action ? { action } : {}),
      ...(q
        ? { OR: [{ rowId: { contains: q } }, { userName: { contains: q, mode: "insensitive" } }, { userEmail: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/admin/system-tables" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToTables}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      <div className="mt-6">
        <SystemLogFilters tables={SYSTEM_TABLES.map((t) => t.label)} />
      </div>
      <p className="mt-3 text-xs text-slate-400">{d.showingLast.replace("{count}", String(entries.length))}</p>

      <div className="mt-3 space-y-3">
        {entries.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">{d.noRows}</p>
        )}
        {entries.map((e) => {
          const changes = (e.changes ?? {}) as Record<string, Change>;
          const impact = (e.impact ?? {}) as { cascades?: Record<string, number>; setNull?: Record<string, number> };
          const key = SYSTEM_TABLES.find((t) => t.label === e.table)?.key;
          return (
            <details key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500">{formatDateTime(e.createdAt, dateOptions)}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    e.action === "DELETE" ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {e.action === "DELETE" ? d.deleted : d.edited}
                </span>
                <span className="font-medium text-slate-800">{e.table}</span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{e.rowId}</code>
                <span className="text-slate-500">
                  {e.userName} · {e.userEmail}
                </span>
                {e.action === "UPDATE" && <span className="text-xs text-slate-400">{Object.keys(changes).length} {d.fields}</span>}
              </summary>
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm">
                {e.action === "UPDATE" && (
                  <table className="min-w-full text-xs">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-1 pr-4">{d.field}</th>
                        <th className="py-1 pr-4">{d.before}</th>
                        <th className="py-1">{d.after}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(changes).map(([field, c]) => (
                        <tr key={field} className="align-top">
                          <td className="py-1 pr-4 font-medium text-slate-700">{field}</td>
                          <td className="max-w-xs break-words py-1 pr-4 text-red-700">{show(c.from)}</td>
                          <td className="max-w-xs break-words py-1 text-emerald-700">{show(c.to)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {e.action === "DELETE" && (
                  <>
                    {Object.keys(impact.cascades ?? {}).length > 0 && (
                      <p className="text-amber-800">
                        {d.alsoDeleted}: {Object.entries(impact.cascades!).map(([t, n]) => `${n} ${t}`).join(", ")}
                      </p>
                    )}
                    {Object.keys(impact.setNull ?? {}).length > 0 && (
                      <p className="text-slate-700">
                        {d.unlinked}: {Object.entries(impact.setNull!).map(([t, n]) => `${n} ${t}`).join(", ")}
                      </p>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{d.deletedRow}</p>
                      <pre className="max-h-60 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                        {JSON.stringify(e.before, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
                {e.ip && <p className="text-xs text-slate-400">IP {e.ip}</p>}
                {key && e.action === "UPDATE" && (
                  <Link
                    href={`/admin/system-tables/${key}?filter=${encodeURIComponent(`id:${e.rowId}`)}`}
                    className="text-xs font-medium text-violet-600 hover:text-violet-700"
                  >
                    {d.openRow} →
                  </Link>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
