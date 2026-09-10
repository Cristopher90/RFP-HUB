import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { syncAwaitingStart } from "@/lib/rfpStatus";
import { getViewerPreferences } from "@/lib/preferences";
import { localeForLanguage } from "@/i18n/locale";
import { getDictionary } from "@/i18n/getDictionary";
import { ResponseForm } from "./ResponseForm";

export default async function RespondPage({
  params,
}: PageProps<"/respond/[token]">) {
  const { token } = await params;
  const preferences = await getViewerPreferences();
  const locale = localeForLanguage(preferences.language);
  const dateOptions = { locale, timeZone: preferences.timeZone };
  const currencyOptions = { locale, currency: preferences.currency };
  const dictionary = getDictionary(preferences.language);

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      supplier: true,
      rfp: {
        include: {
          items: { orderBy: { order: "asc" } },
          questions: { orderBy: { order: "asc" } },
        },
      },
      response: {
        include: { answers: true, itemPrices: true },
      },
    },
  });

  if (!invitation) notFound();

  invitation.rfp.status = await syncAwaitingStart(invitation.rfp);

  // AWAITING_START already went through approval and is otherwise ready —
  // it's just not time yet — so it counts as "published" (no more waiting
  // on the comprador) but the invitation only becomes visible/viewable
  // once its fecha y hora de inicio actually arrives.
  const isPublished =
    invitation.rfp.status === "OPEN" ||
    invitation.rfp.status === "AWAITING_START" ||
    invitation.rfp.status === "CLOSED";

  if (invitation.status === "INVITED" && invitation.rfp.status === "OPEN") {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  const { rfp, supplier, response } = invitation;
  const isClosed = rfp.status === "CLOSED";
  const isAwaitingStart = rfp.status === "AWAITING_START";
  const isNotYetPublished = !isPublished;
  // Genuinely internal (Contenido Interno) questions are never sent to the
  // supplier — filter them out before anything reaches the client, not
  // just at render time. A Contenido Externo question answered by the
  // buyer ("Interna" en Requiere respuesta) keeps visibility EXTERNAL and
  // IS sent, shown read-only with the buyer's answer.
  const supplierQuestions = rfp.questions.filter(
    (q) => q.visibility !== "INTERNAL",
  );
  // Buyer-only item fields (weight, decimals precision aside, historicalPrice,
  // commodity, locked, ...) must not reach the supplier's browser — strip
  // them here, not just at render time, same discipline as supplierQuestions.
  const supplierItems = rfp.items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    decimals: item.decimals,
    customFields: item.customFields,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
          {dictionary.respondPage.invitationLabel}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {rfp.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{rfp.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>{dictionary.respondPage.buyer}: {rfp.buyerName}</span>
          <span>{dictionary.respondPage.deadline}: {formatDate(rfp.deadlineAt, dateOptions)}</span>
          <span>
            {dictionary.respondPage.supplier}: {supplier.name} ({supplier.company})
          </span>
          {rfp.commodity && <span>{dictionary.respondPage.commodity}: {rfp.commodity}</span>}
          {rfp.region && <span>{dictionary.respondPage.region}: {rfp.region}</span>}
          {rfp.startDate && (
            <span>{dictionary.respondPage.start}: {formatDateTime(rfp.startDate, dateOptions)}</span>
          )}
        </div>
      </div>

      {response ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-base font-semibold text-emerald-800">
            {dictionary.respondPage.thanksPrefix}{" "}
            {formatDateTime(response.submittedAt, dateOptions)}.
          </h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-emerald-100 bg-white">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">{dictionary.respondPage.item}</th>
                  <th className="px-4 py-2">{dictionary.respondPage.unitPrice}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rfp.items.map((item) => {
                  const price = response.itemPrices.find(
                    (p) => p.itemId === item.id,
                  );
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2">
                        {price ? formatCurrency(price.unitPrice, currencyOptions) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          {supplierQuestions.length > 0 && (
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {supplierQuestions.map((q) => {
                const answer = response.answers.find(
                  (a) => a.questionId === q.id,
                );
                if (!answer) return null;
                if (q.type === "ATTACHMENT") {
                  const [href, filename] = answer.value.split("|");
                  return (
                    <div key={q.id}>
                      <p className="font-medium">{q.text}</p>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-600 underline hover:text-violet-700"
                      >
                        {filename ?? dictionary.respondPage.viewFile}
                      </a>
                    </div>
                  );
                }
                return (
                  <div key={q.id}>
                    <p className="font-medium">{q.text}</p>
                    <p className="text-slate-500">
                      {q.type === "MONEY"
                        ? formatCurrency(Number(answer.value), currencyOptions)
                        : answer.value}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isNotYetPublished ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {dictionary.respondPage.notYetPublished}
        </div>
      ) : isClosed ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {dictionary.respondPage.closedMessage}
        </div>
      ) : isAwaitingStart ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {dictionary.respondPage.notStartedPrefix} {formatDateTime(rfp.startDate!, dateOptions)}.
        </div>
      ) : (
        <ResponseForm
          token={token}
          items={supplierItems}
          questions={supplierQuestions}
          rfpCommodity={rfp.commodity}
          rfpRegion={rfp.region}
        />
      )}
    </div>
  );
}
