import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime, formatRfpNumber } from "@/lib/format";
import { isEmailKind } from "@/lib/emailKinds";
import { EmailLogFilters } from "./EmailLogFilters";

const LIMIT = 200;
const STATUS_STYLE = {
  SENT: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  NOT_SENT: "bg-amber-100 text-amber-700",
} as const;

export default async function EmailLogPage({
  searchParams,
}: PageProps<"/admin/email-log">) {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const { user } = scope;
  const dictionary = getDictionary(user.language);
  const d = dictionary.emailLogPage;
  const dateOptions = { locale: localeForLanguage(user.language), timeZone: user.timezone };

  const sp = await searchParams;
  const clientId = typeof sp.clientId === "string" && sp.clientId ? sp.clientId : undefined;
  const status =
    sp.status === "SENT" || sp.status === "FAILED" || sp.status === "NOT_SENT"
      ? sp.status
      : undefined;
  const kind = typeof sp.kind === "string" && isEmailKind(sp.kind) ? sp.kind : undefined;

  const [clients, logs] = await Promise.all([
    prisma.client.findMany({ orderBy: { description: "asc" } }),
    prisma.emailLog.findMany({
      where: { ...(clientId ? { clientId } : {}), ...(status ? { status } : {}), ...(kind ? { kind } : {}) },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
  ]);

  const rfpIds = [...new Set(logs.map((l) => l.rfpId).filter((id): id is string => Boolean(id)))];
  const rfps = rfpIds.length
    ? await prisma.rfp.findMany({
        where: { id: { in: rfpIds } },
        select: { id: true, number: true },
      })
    : [];
  const rfpNumber = new Map(rfps.map((r) => [r.id, r.number]));
  const clientLabel = new Map(clients.map((c) => [c.id, c.code]));

  const statusLabel = (s: keyof typeof STATUS_STYLE) =>
    s === "SENT" ? d.sent : s === "FAILED" ? d.failed : d.notSent;
  const kindLabel = (k: string) =>
    isEmailKind(k) ? dictionary.emailKindLabels[k] : k;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>

      <div className="mt-6">
        <EmailLogFilters clients={clients} />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {d.showingLast.replace("{count}", String(logs.length))}
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{d.date}</th>
              <th className="px-4 py-3">{d.client}</th>
              <th className="px-4 py-3">{d.rfp}</th>
              <th className="px-4 py-3">{d.type}</th>
              <th className="px-4 py-3">{d.recipient}</th>
              <th className="px-4 py-3">{d.subject}</th>
              <th className="px-4 py-3">{d.status}</th>
              <th className="px-4 py-3">{d.detail}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {d.noRows}
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const number = log.rfpId ? rfpNumber.get(log.rfpId) : undefined;
              return (
                <tr key={log.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDateTime(log.createdAt, dateOptions)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.clientId ? (clientLabel.get(log.clientId) ?? "—") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {log.rfpId && number !== undefined ? (
                      <Link
                        href={`/rfps/${log.rfpId}`}
                        className="font-medium text-violet-600 hover:text-violet-700"
                      >
                        {formatRfpNumber(number)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{kindLabel(log.kind)}</td>
                  <td className="px-4 py-3 text-slate-600">{log.toEmail}</td>
                  <td className="px-4 py-3 text-slate-800">{log.subject}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[log.status]}`}
                    >
                      {statusLabel(log.status)}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-500">
                    {log.status === "FAILED" && log.error}
                    {log.status === "NOT_SENT" && d.notSentHint}
                    {log.status === "SENT" && log.sentTo !== log.toEmail && (
                      <>
                        {d.redirectedTo} {log.sentTo}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
