import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { formatCurrency, formatDate, formatRfpNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { getViewerPreferences } from "@/lib/preferences";
import { localeForLanguage } from "@/i18n/locale";
import { getDictionary } from "@/i18n/getDictionary";

export default async function RfpRoundsPage({
  params,
}: PageProps<"/rfps/[id]/rounds">) {
  const scope = await requireClientScope();
  const { id } = await params;
  const preferences = await getViewerPreferences();
  const locale = localeForLanguage(preferences.language);
  const dateOptions = { locale, timeZone: preferences.timeZone };
  const currencyOptions = { locale, currency: preferences.currency };
  const dictionary = getDictionary(preferences.language);

  const rfp = await prisma.rfp.findUnique({
    where: { id },
    select: { id: true, seriesRootId: true, clientId: true },
  });
  if (!rfp) notFound();
  if (!scope.isSuperAdmin && rfp.clientId !== scope.user.clientId) notFound();

  const seriesRootId = rfp.seriesRootId ?? rfp.id;

  const rounds = await prisma.rfp.findMany({
    where: { OR: [{ id: seriesRootId }, { seriesRootId }] },
    orderBy: { roundNumber: "asc" },
    include: {
      items: true,
      invitations: {
        include: {
          supplier: true,
          response: { include: { itemPrices: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/rfps/${id}`}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.roundsPage.backToRfp}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.roundsPage.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.roundsPage.subtitle}
      </p>

      <div className="mt-8 space-y-6">
        {rounds.map((round) => {
          const totals = round.invitations
            .filter((inv) => inv.response)
            .map((inv) => {
              const total = round.items.reduce((sum, item) => {
                const price = inv.response!.itemPrices.find(
                  (p) => p.itemId === item.id,
                );
                return sum + (price ? price.unitPrice * item.quantity : 0);
              }, 0);
              return {
                invitationId: inv.id,
                supplierName: inv.supplier.name,
                supplierCompany: inv.supplier.company,
                total,
                awarded: inv.id === round.awardedInvitationId,
              };
            })
            .sort((a, b) => a.total - b.total);
          const bestTotal = totals.length > 0 ? totals[0].total : null;

          return (
            <div
              key={round.id}
              className={`rounded-xl border p-6 shadow-sm ${
                round.id === id
                  ? "border-violet-300 bg-violet-50/40"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link
                    href={`/rfps/${round.id}`}
                    className="font-medium text-slate-900 hover:text-violet-600"
                  >
                    {dictionary.roundsPage.roundPrefix} {round.roundNumber} — {formatRfpNumber(round.number)}{" "}
                    {round.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {dictionary.roundsPage.closes}: {formatDate(round.deadlineAt, dateOptions)}
                  </p>
                </div>
                <StatusBadge status={round.status} language={preferences.language} />
              </div>

              {totals.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  {dictionary.roundsPage.noResponsesYet}
                </p>
              ) : (
                <table className="mt-4 w-full text-sm">
                  <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">{dictionary.roundsPage.supplier}</th>
                      <th className="py-2 pr-4">{dictionary.roundsPage.totalPrice}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {totals.map((t) => (
                      <tr key={t.invitationId}>
                        <td className="py-2 pr-4 text-slate-700">
                          {t.supplierName}
                          <span className="ml-1 text-xs text-slate-400">
                            ({t.supplierCompany})
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {formatCurrency(t.total, currencyOptions)}
                          {bestTotal !== null && t.total === bestTotal && (
                            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              {dictionary.roundsPage.best}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {t.awarded && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                              {dictionary.roundsPage.awarded}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
