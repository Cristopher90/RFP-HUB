import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { formatCurrency } from "@/lib/format";
import { localeForLanguage } from "@/i18n/locale";
import { colorForIndex } from "@/lib/chartColors";
import { isQuestionConditionMet } from "@/lib/questionCondition";
import { describeApprovals, canDecideActiveLevel } from "@/lib/approvalEngine";
import { ComparisonCharts } from "./ComparisonCharts";
import { AwardPanel } from "./AwardPanel";
import { ItemPriceTable } from "./ItemPriceTable";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import type { AwardCriteria } from "./actions";

export default async function ComparePage({
  params,
}: PageProps<"/rfps/[id]/compare">) {
  const { id } = await params;
  const scope = await requireClientScope();
  const user = scope.user;

  const rfp = await prisma.rfp.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
      invitations: {
        include: {
          supplier: true,
          response: { include: { itemPrices: true, answers: true } },
        },
        orderBy: { invitedAt: "asc" },
      },
    },
  });

  if (!rfp) notFound();
  if (!scope.isSuperAdmin && rfp.clientId !== user.clientId) notFound();

  const locale = localeForLanguage(user.language);
  const currencyOptions = { locale, currency: user.currency };

  const responded = rfp.invitations.filter((inv) => inv.response);

  const totals = new Map<string, number>();
  for (const inv of responded) {
    const total = rfp.items.reduce((sum, item) => {
      const price = inv.response!.itemPrices.find((p) => p.itemId === item.id);
      return sum + (price ? price.unitPrice * item.quantity : 0);
    }, 0);
    totals.set(inv.id, total);
  }
  const bestTotal =
    totals.size > 0 ? Math.min(...Array.from(totals.values())) : null;

  const colorByInvitation = new Map(
    responded.map((inv, index) => [inv.id, colorForIndex(index)]),
  );

  const totalsChartData = responded.map((inv) => ({
    id: inv.id,
    supplierId: inv.supplierId,
    label: inv.supplier.name,
    sublabel: inv.supplier.company,
    value: totals.get(inv.id) ?? 0,
    color: colorByInvitation.get(inv.id)!,
  }));

  const itemsChartData = rfp.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    bars: responded
      .map((inv) => {
        const price = inv.response!.itemPrices.find(
          (p) => p.itemId === item.id,
        )?.unitPrice;
        return price === undefined
          ? null
          : {
              id: inv.id,
              label: inv.supplier.name,
              sublabel: inv.supplier.company,
              value: price,
              color: colorByInvitation.get(inv.id)!,
            };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null),
  }));

  const internalQuestions = rfp.questions.filter(
    (q) => q.visibility === "INTERNAL",
  );
  const header = { commodity: rfp.commodity, region: rfp.region };
  const internalNotesByInvitation = new Map(
    responded.map((inv) => {
      const answerValues = Object.fromEntries(
        inv.response!.answers.map((a) => [a.questionId, a.value]),
      );
      const relevant = internalQuestions.filter((q) =>
        isQuestionConditionMet(q, header, answerValues),
      );
      return [inv.id, relevant];
    }),
  );

  const awardSuppliers = responded.map((inv) => ({
    invitationId: inv.id,
    supplierId: inv.supplierId,
    name: inv.supplier.name,
    company: inv.supplier.company,
    color: colorByInvitation.get(inv.id)!,
    totalPrice: totals.get(inv.id) ?? 0,
    itemPrices: inv.response!.itemPrices.map((p) => ({
      itemId: p.itemId,
      unitPrice: p.unitPrice,
    })),
    answers: inv.response!.answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      value: a.value,
      score: a.score,
    })),
  }));

  const itemPriceRows = rfp.items.map((item) => {
    const prices = responded.map((inv) => ({
      invId: inv.id,
      price: inv.response!.itemPrices.find((p) => p.itemId === item.id)
        ?.unitPrice,
    }));
    const currentPrices = prices
      .map((p) => p.price)
      .filter((p): p is number => p !== undefined);
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      historicalPrice: item.historicalPrice,
      bestCurrentPrice:
        currentPrices.length > 0 ? Math.min(...currentPrices) : null,
      prices,
    };
  });

  // Precios de proyectos anteriores: para cada artículo de esta RFP, busca
  // en TODAS las demás RFPs artículos con el mismo código o descripción y
  // toma el precio cotizado más bajo encontrado en esas RFPs anteriores.
  const normalize = (s: string) => s.trim().toLowerCase();
  const otherRfpItems = await prisma.rfpItem.findMany({
    where: { rfpId: { not: rfp.id } },
    select: {
      code: true,
      name: true,
      description: true,
      itemPrices: { select: { unitPrice: true } },
      rfp: { select: { id: true, title: true } },
    },
  });
  const previousProjectMatches = rfp.items
    .map((item) => {
      const codeNorm = item.code ? normalize(item.code) : null;
      const descNorm = item.description ? normalize(item.description) : null;
      const matches = otherRfpItems.filter((oi) => {
        if (codeNorm && oi.code && normalize(oi.code) === codeNorm) return true;
        if (descNorm && oi.description && normalize(oi.description) === descNorm)
          return true;
        return false;
      });
      let best: { price: number; rfpId: string; rfpTitle: string } | null = null;
      for (const m of matches) {
        for (const p of m.itemPrices) {
          if (!best || p.unitPrice < best.price) {
            best = { price: p.unitPrice, rfpId: m.rfp.id, rfpTitle: m.rfp.title };
          }
        }
      }
      return best ? { itemId: item.id, itemName: item.name, itemCode: item.code, best } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const awardLevels = rfp.pendingAwardInvitationId
    ? await describeApprovals(rfp.id, "AWARD", currencyOptions)
    : [];
  const canDecideAward =
    Boolean(rfp.pendingAwardInvitationId) &&
    (await canDecideActiveLevel(rfp.id, "AWARD", user.id));

  // "Oferta a ciegas": mientras la plantilla aplicada lo pida y la RFP siga
  // Abierta, el comprador no ve montos/respuestas de proveedores. Se
  // revela automáticamente al cerrar (o si ya no está Abierta por otro
  // motivo, ej. adjudicada).
  const isBlind = rfp.hideResponsesUntilClosed && rfp.status === "OPEN";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href={`/rfps/${rfp.id}`}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Volver a la RFP
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Monitor y Adjudicación &middot; {rfp.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {responded.length} de {rfp.invitations.length} proveedores han
        respondido.
      </p>

      {previousProjectMatches.length > 0 && (
        <CollapsibleSection
          title="Precios de proyectos anteriores"
          subtitle="Mejor precio encontrado en otras RFPs con el mismo código de artículo o descripción."
          storageKey="monitor-previous-projects"
          className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {previousProjectMatches.map((m) => (
              <li
                key={m.itemId}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-slate-700">
                  {m.itemCode && (
                    <span className="mr-1.5 text-xs text-slate-400">
                      {m.itemCode}
                    </span>
                  )}
                  {m.itemName}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(m.best.price, currencyOptions)}
                  </span>
                  <Link
                    href={`/rfps/${m.best.rfpId}`}
                    className="text-xs font-medium text-violet-600 hover:text-violet-700"
                  >
                    Ver RFP &quot;{m.best.rfpTitle}&quot; &rarr;
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {responded.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Todavía no hay cotizaciones para comparar.
        </div>
      ) : isBlind ? (
        <div className="mt-8 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-12 text-center text-amber-800">
          <p className="font-medium">Oferta a ciegas activada</p>
          <p className="mt-1 text-sm">
            Las respuestas de los proveedores se mostrarán una vez que
            cierres la RFP. Ya hay {responded.length} de{" "}
            {rfp.invitations.length} respuestas recibidas.
          </p>
        </div>
      ) : (
        <>
          <CollapsibleSection
            title="Comparación de ofertas"
            storageKey="monitor-charts"
            className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <ComparisonCharts totals={totalsChartData} items={itemsChartData} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Precio por artículo"
            storageKey="monitor-item-prices"
            className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <ItemPriceTable
              suppliers={responded.map((inv) => ({
                id: inv.id,
                name: inv.supplier.name,
                company: inv.supplier.company,
                color: colorByInvitation.get(inv.id)!,
              }))}
              items={itemPriceRows}
              totals={responded.map((inv) => ({
                invId: inv.id,
                total: totals.get(inv.id) ?? 0,
              }))}
              bestTotal={bestTotal}
            />
          </CollapsibleSection>

          {rfp.questions.some((q) => q.visibility === "EXTERNAL") && (
            <CollapsibleSection
              title="Respuestas a preguntas"
              storageKey="monitor-answers"
              className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {responded.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <p className="font-medium text-slate-900">
                      {inv.supplier.name}
                      <span className="ml-1 font-normal text-slate-400">
                        ({inv.supplier.company})
                      </span>
                    </p>
                    <dl className="mt-3 space-y-2 text-sm">
                      {rfp.questions
                        .filter((q) => q.visibility === "EXTERNAL")
                        .map((q) => {
                        const answer = inv.response!.answers.find(
                          (a) => a.questionId === q.id,
                        );
                        return (
                          <div key={q.id}>
                            <dt className="text-slate-500">{q.text}</dt>
                            <dd className="text-slate-800">
                              {!answer ? (
                                "—"
                              ) : q.type === "ATTACHMENT" ? (
                                (() => {
                                  const [href, filename] =
                                    answer.value.split("|");
                                  return (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-violet-600 underline hover:text-violet-700"
                                    >
                                      {filename ?? "Ver archivo"}
                                    </a>
                                  );
                                })()
                              ) : q.type === "MONEY" ? (
                                formatCurrency(Number(answer.value), currencyOptions)
                              ) : (
                                answer.value
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {internalQuestions.length > 0 && (
            <CollapsibleSection
              title="Notas internas"
              subtitle="Solo las ve el comprador. Aparecen por proveedor cuando se cumple su condición (si tienen una)."
              storageKey="monitor-internal-notes"
              className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {responded.map((inv) => {
                  const notes = internalNotesByInvitation.get(inv.id) ?? [];
                  if (notes.length === 0) return null;
                  return (
                    <div
                      key={inv.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <p className="font-medium text-slate-900">
                        {inv.supplier.name}
                        <span className="ml-1 font-normal text-slate-400">
                          ({inv.supplier.company})
                        </span>
                      </p>
                      <ul className="mt-3 space-y-2 text-sm">
                        {notes.map((q) => (
                          <li
                            key={q.id}
                            className="rounded-md bg-slate-200/60 px-3 py-2 text-slate-700"
                          >
                            {q.text}
                            {q.respondedBy === "BUYER" && (
                              <span className="ml-2 font-medium text-slate-900">
                                {q.buyerAnswerValue || "— sin responder"}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          <div className="mt-10">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">
              Adjudicación
            </h2>
            <AwardPanel
              rfpId={rfp.id}
              rfpNumber={rfp.number}
              scoringEnabled={rfp.scoringEnabled}
              items={rfp.items.map((i) => ({
                id: i.id,
                name: i.name,
                weight: i.weight,
              }))}
              questions={rfp.questions
                .filter(
                  (q) =>
                    !q.isPrerequisite &&
                    q.visibility === "EXTERNAL" &&
                    q.type !== "INFO" &&
                    q.respondedBy !== "BUYER",
                )
                .map((q) => ({
                  id: q.id,
                  text: q.text,
                  type: q.type,
                  weight: q.weight,
                }))}
              suppliers={awardSuppliers}
              awardedInvitationId={rfp.awardedInvitationId}
              awardedAt={rfp.awardedAt ? rfp.awardedAt.toISOString() : null}
              initialCriteria={rfp.awardCriteria as AwardCriteria | null}
              initialPriceWeightPct={rfp.priceWeightPct}
              initialPendingInvitationId={rfp.pendingAwardInvitationId}
              awardLevels={awardLevels}
              canDecideAward={canDecideAward}
            />
          </div>
        </>
      )}
    </div>
  );
}
