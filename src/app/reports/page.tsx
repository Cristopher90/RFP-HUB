import { requireClientScope } from "@/lib/clientScope";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import { zonedTimeToUtc } from "@/lib/timezone";
import { loadReportData } from "@/lib/reportsData";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { RobotMascot } from "@/components/RobotMascot";
import { ReportsFilters } from "./ReportsFilters";
import { ReportsView } from "./ReportsView";

// Reports over the RFPs the signed-in person can see (see reportsData.ts for
// the exact visibility rule per role).
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const scope = await requireClientScope();
  const { user } = scope;
  const dictionary = getDictionary(user.language);
  const d = dictionary.reportsPage;

  const clients = scope.isSuperAdmin
    ? await prisma.client.findMany({ orderBy: { description: "asc" } })
    : [];
  const effectiveClientId = scope.isSuperAdmin
    ? typeof sp.clientId === "string" && sp.clientId
      ? sp.clientId
      : undefined
    : (user.clientId ?? undefined);

  const dateParam = (key: string) =>
    typeof sp[key] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp[key] as string) ? (sp[key] as string) : "";
  const fromParam = dateParam("from");
  const toParam = dateParam("to");
  const from = fromParam ? zonedTimeToUtc(`${fromParam}T00:00`, user.timezone) : undefined;
  const to = toParam
    ? new Date(zonedTimeToUtc(`${toParam}T23:59`, user.timezone).getTime() + 59_999)
    : undefined;

  const data = effectiveClientId
    ? await loadReportData({ user, clientId: effectiveClientId, from, to })
    : null;

  const scopeText = data
    ? data.scope === "all"
      ? d.scopeAll
      : data.scope === "assigned"
        ? d.scopeAssigned
        : d.scopeMine
    : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center gap-6">
        <RobotMascot className="h-32 w-28 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
          <div className="mt-3 inline-block max-w-xl rounded-2xl rounded-tl-sm border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
            {data
              ? data.rfpCount === 0
                ? d.robotNone
                : `${d.robotGreeting} ${d.robotSummary.replace("{count}", String(data.rfpCount))} ${scopeText}`
              : d.robotPickClient}
          </div>
        </div>
      </div>

      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}

      {data ? (
        <div className="mt-6 space-y-6">
          <ReportsFilters />
          <ReportsView data={data} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
