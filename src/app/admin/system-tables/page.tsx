import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientScope } from "@/lib/clientScope";
import { prisma } from "@/lib/prisma";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { SYSTEM_TABLES, SYSTEM_TABLE_GROUPS, groupOfTable } from "@/lib/systemTables";
import { getDictionary } from "@/i18n/getDictionary";

export default async function SystemTablesPage() {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const dictionary = getDictionary(scope.user.language);

  const counts = await Promise.all(
    SYSTEM_TABLES.map(async (t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (prisma as any)[t.model];
      const count: number = await delegate.count();
      return { ...t, count };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.systemTablesPage.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.systemTablesPage.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.systemTablesPage.subtitle}
      </p>
      <Link
        href="/admin/system-tables/log"
        className="mt-4 inline-block rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
      >
        {dictionary.systemTableEditor.viewLog}
      </Link>
      <Link
        href="/admin/system-tables/relations"
        className="ml-3 mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        {dictionary.systemTablesPage.relationsButton}
      </Link>
      <div className="mt-8 space-y-4">
        {[...SYSTEM_TABLE_GROUPS.map((g) => g.key), "other"].map((groupKey) => {
          const tables = counts.filter((t) => groupOfTable(t.label) === groupKey);
          if (tables.length === 0) return null;
          return (
            <CollapsibleSection
              key={groupKey}
              title={dictionary.systemTablesPage[`group_${groupKey}` as keyof typeof dictionary.systemTablesPage]}
              subtitle={`${tables.length} ${dictionary.systemTablesPage.tablesCount} · ${tables.reduce((sum, t) => sum + t.count, 0)} ${dictionary.systemTablesPage.rowsHeader.toLowerCase()}`}
              storageKey={`system-tables-${groupKey}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <tbody className="divide-y divide-slate-100">
                  {tables.map((t) => (
                    <tr key={t.key} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{t.label}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">{t.count}</td>
                      <td className="whitespace-nowrap py-2.5 text-right">
                        <Link
                          href={`/admin/system-tables/relations?table=${t.label}`}
                          className="mr-4 text-sm text-slate-500 hover:text-slate-700"
                        >
                          {dictionary.systemTablesPage.relationsShort}
                        </Link>
                        <Link
                          href={`/admin/system-tables/${t.key}`}
                          className="text-sm font-medium text-violet-600 hover:text-violet-700"
                        >
                          {dictionary.systemTablesPage.view}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}
