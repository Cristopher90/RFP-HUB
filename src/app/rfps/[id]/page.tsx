import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import {
  formatCurrency,
  formatDateTime,
  formatRfpNumber,
} from "@/lib/format";
import { isQuestionConditionMet } from "@/lib/questionCondition";
import {
  describeApprovals,
  canDecideActiveLevel,
  getApprovalHistory,
} from "@/lib/approvalEngine";
import { groupBySection } from "@/lib/sections";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { InviteSupplierForm } from "./InviteSupplierForm";
import { BuyerQuestionForm } from "./BuyerQuestionForm";
import { DraftActions } from "./DraftActions";
import { CopyRfpButton } from "./CopyRfpButton";
import { PublishApprovalSection } from "./PublishApprovalSection";
import { CountdownTimer } from "./CountdownTimer";
import { closeRfp, reopenRfp } from "./actions";
import { syncAwaitingStart } from "@/lib/rfpStatus";
import { localeForLanguage } from "@/i18n/locale";
import { questionTypeLabel, approvalStageLabel } from "@/i18n/labels";
import { getDictionary } from "@/i18n/getDictionary";

export default async function RfpDetailPage({
  params,
}: PageProps<"/rfps/[id]">) {
  const { id } = await params;

  const [rfp, scope] = await Promise.all([
    prisma.rfp.findUnique({
      where: { id },
      include: {
        items: { orderBy: { order: "asc" } },
        questions: { orderBy: { order: "asc" } },
        invitations: {
          include: { supplier: true, response: true },
          orderBy: { invitedAt: "asc" },
        },
        basedOnRfp: { select: { number: true, title: true } },
      },
    }),
    requireClientScope(),
  ]);

  if (!rfp) notFound();
  if (!scope.isSuperAdmin && rfp.clientId !== scope.user.clientId) notFound();
  const user = scope.user;
  rfp.status = await syncAwaitingStart(rfp);
  const locale = localeForLanguage(user.language);
  const dictionary = getDictionary(user.language);
  const dateOptions = { locale, timeZone: user.timezone };
  const currencyOptions = { locale, currency: user.currency };

  const supplierDirectoryRaw = await prisma.supplierDirectory.findMany({
    where: { status: "ACTIVE", clientId: rfp.clientId },
    include: { supplierUsers: { orderBy: { name: "asc" } } },
    orderBy: { companyName: "asc" },
  });
  const supplierDirectory = supplierDirectoryRaw.map((s) => ({
    ...s,
    contacts: s.supplierUsers.map((u) => ({
      id: u.id,
      name: `${u.name} ${u.lastName}`.trim(),
      email: u.email,
    })),
  }));

  const publishLevels =
    rfp.status === "PENDING_PUBLISH_APPROVAL"
      ? await describeApprovals(rfp.id, "PUBLISH", currencyOptions)
      : [];
  const canDecidePublish =
    rfp.status === "PENDING_PUBLISH_APPROVAL" &&
    (await canDecideActiveLevel(rfp.id, "PUBLISH", user.id));

  const history: { date: Date; label: string; detail?: string }[] = [
    { date: rfp.createdAt, label: dictionary.rfpDetail.creation },
  ];
  if (rfp.publishedAt) history.push({ date: rfp.publishedAt, label: dictionary.rfpDetail.publication });
  for (const h of await getApprovalHistory(rfp.id)) {
    history.push({
      date: new Date(h.decidedAt),
      label: `${h.decision === "APPROVED" ? dictionary.rfpDetail.approved : dictionary.rfpDetail.rejected} · ${approvalStageLabel(dictionary, h.stage)} (${dictionary.rfpDetail.levelPrefix} ${h.order + 1})`,
      detail: h.reason ? `${h.userName} — ${h.reason}` : h.userName,
    });
  }
  if (rfp.closedAt) history.push({ date: rfp.closedAt, label: dictionary.rfpDetail.closure });
  if (rfp.status === "CLOSED") {
    for (const inv of rfp.invitations) {
      if (inv.response) {
        history.push({
          date: inv.response.submittedAt,
          label: `${dictionary.rfpDetail.responseFrom} ${inv.supplier.name}`,
        });
      }
    }
  }
  history.sort((a, b) => a.date.getTime() - b.date.getTime());

  const respondedCount = rfp.invitations.filter((i) => i.response).length;
  const awardedInvitation = rfp.invitations.find(
    (i) => i.id === rfp.awardedInvitationId,
  );
  const appliedTemplates = rfp.appliedTemplates
    ? (JSON.parse(rfp.appliedTemplates) as { id: string; name: string }[])
    : [];

  // Section membership follows visibility, not who answers — a Contenido
  // Externo question marked "responde el comprador" stays visible here
  // (and to the proveedor) instead of moving to "Preguntas para el
  // comprador", which is reserved for genuinely internal (never-sent)
  // content.
  const supplierQuestions = rfp.questions.filter(
    (q) => q.visibility !== "INTERNAL",
  );
  const internalOnlyQuestions = rfp.questions.filter(
    (q) => q.visibility === "INTERNAL",
  );
  // Condition evaluation needs every buyer-given answer regardless of
  // section, since another question's condition may reference one that
  // lives in Contenido Externo.
  const buyerAnswerValues = Object.fromEntries(
    rfp.questions
      .filter((q) => q.respondedBy === "BUYER")
      .map((q) => [q.id, q.buyerAnswerValue ?? ""]),
  );
  const visibleBuyerQuestions = internalOnlyQuestions.filter((q) =>
    isQuestionConditionMet(
      q,
      { commodity: rfp.commodity, region: rfp.region },
      buyerAnswerValues,
    ),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
            {dictionary.rfpDetail.backToAll}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            <span className="mr-2 font-normal text-slate-400">
              {formatRfpNumber(rfp.number)}
            </span>
            {rfp.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <StatusBadge status={rfp.status} language={user.language} />
            {awardedInvitation && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {dictionary.rfpDetail.awardedTo} {awardedInvitation.supplier.name}
              </span>
            )}
            <Link
              href={`/rfps/${rfp.id}/rounds`}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              {dictionary.rfpDetail.roundPrefix} {rfp.roundNumber}
            </Link>
            {rfp.publishedAt && <span>{dictionary.rfpDetail.opens}: {formatDateTime(rfp.publishedAt, dateOptions)}</span>}
            <span>{dictionary.rfpDetail.closes}: {formatDateTime(rfp.deadlineAt, dateOptions)}</span>
            {rfp.status === "OPEN" && (
              <CountdownTimer deadline={rfp.deadlineAt.toISOString()} />
            )}
            {rfp.basedOnRfp && (
              <Link
                href={`/rfps/${rfp.basedOnRfpId}`}
                className="font-medium text-violet-600 hover:underline"
              >
                {dictionary.rfpForm.previousRfpPrefix}: {formatRfpNumber(rfp.basedOnRfp.number)} →
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {rfp.status !== "DRAFT" &&
            rfp.status !== "PENDING_PUBLISH_APPROVAL" && (
              <Link
                href={`/rfps/${rfp.id}/compare`}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
              >
                {dictionary.rfpDetail.monitorAndAward} ({respondedCount})
              </Link>
            )}
          <a
            href={`/rfps/${rfp.id}/export`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {dictionary.rfpDetail.exportToExcel}
          </a>
          <CopyRfpButton rfpId={rfp.id} />
          {rfp.status === "DRAFT" && <DraftActions rfpId={rfp.id} />}
          {(rfp.status === "OPEN" ||
            rfp.status === "AWAITING_START" ||
            rfp.status === "CLOSED") && (
            <form
              action={async () => {
                "use server";
                if (rfp.status === "CLOSED") {
                  await reopenRfp(rfp.id);
                } else {
                  await closeRfp(rfp.id);
                }
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {rfp.status === "CLOSED" ? dictionary.rfpDetail.reopen : dictionary.rfpDetail.closeRfp}
              </button>
            </form>
          )}
        </div>
      </div>

      {rfp.status === "PENDING_PUBLISH_APPROVAL" && (
        <PublishApprovalSection
          rfpId={rfp.id}
          levels={publishLevels}
          canDecide={canDecidePublish}
        />
      )}

      {rfp.description && (
        <p className="mb-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {rfp.description}
        </p>
      )}

      {appliedTemplates.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{dictionary.rfpDetail.templateApplied}</span>
          {appliedTemplates.map((t) => (
            <Link
              key={t.id}
              href={`/admin/templates/${t.id}`}
              className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-200"
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-400">{dictionary.rfpForm.commodityLabel}</p>
          <p className="font-medium text-slate-700">{rfp.commodity || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">{dictionary.rfpForm.regionLabel}</p>
          <p className="font-medium text-slate-700">{rfp.region || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">{dictionary.rfpDetail.startLabel}</p>
          <p className="font-medium text-slate-700">
            {rfp.startDate ? formatDateTime(rfp.startDate, dateOptions) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">{dictionary.rfpDetail.estimatedPriceLabel}</p>
          <p className="font-medium text-slate-700">
            {rfp.estimatedPrice != null
              ? formatCurrency(rfp.estimatedPrice, currencyOptions)
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">
            {dictionary.rfpForm.originLabel} <span className="text-slate-300">{dictionary.rfpDetail.internalAnnotation}</span>
          </p>
          <p className="font-medium text-slate-700">{rfp.origin || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">
            {dictionary.rfpForm.predecessorLabel} <span className="text-slate-300">{dictionary.rfpDetail.internalAnnotation}</span>
          </p>
          <p className="font-medium text-slate-700">
            {rfp.predecessorDocument || "—"}
          </p>
        </div>
      </div>

      <CollapsibleSection
        title={dictionary.rfpForm.itemsTitle}
        storageKey="rfp-detail-items"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="-mx-6 -mb-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2">{dictionary.rfpForm.codePlaceholder}</th>
                <th className="px-6 py-2">{dictionary.itemCatalogPicker.item}</th>
                <th className="px-6 py-2">{dictionary.itemCatalogPicker.description}</th>
                <th className="px-6 py-2">{dictionary.rfpForm.quantityPlaceholder}</th>
                <th className="px-6 py-2">{dictionary.rfpForm.unitPlaceholder}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupBySection(rfp.items).map((group, groupIdx) => (
                <Fragment key={group.name ?? `sin-seccion-${groupIdx}`}>
                  {group.name !== null && (
                    <tr className="bg-slate-50">
                      <td colSpan={5} className="px-6 py-2">
                        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                          {dictionary.rfpForm.sectionPrefix} {group.sectionNumber}
                        </span>
                        <span className="ml-2 text-xs font-medium text-slate-500">
                          {group.name}
                        </span>
                      </td>
                    </tr>
                  )}
                  {group.entries.map(({ item, label }) => {
                    const customFields = item.customFields
                      ? (JSON.parse(item.customFields) as {
                          label: string;
                          value: string;
                        }[])
                      : [];
                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-3 text-slate-500">
                          {item.code || "—"}
                        </td>
                        <td className="px-6 py-3 font-medium text-slate-800">
                          <span className="mr-2 text-xs font-medium text-slate-400">
                            {label}
                          </span>
                          {item.name}
                          <p className="text-xs font-normal text-slate-400">
                            {dictionary.awardPanel.weightPrefix} {item.weight} &middot; {item.decimals} {dictionary.rfpDetail.decimalsSuffix}
                            {item.commodity && <> &middot; {dictionary.rfpDetail.commodityColon}: {item.commodity}</>}
                            {item.historicalPrice != null && (
                              <>
                                {" "}
                                &middot; {dictionary.rfpDetail.historicalPriceColon}:{" "}
                                {formatCurrency(item.historicalPrice, currencyOptions)}
                              </>
                            )}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                          {item.description ?? "—"}
                          {customFields.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {customFields.map((f, i) => (
                                <li key={i} className="text-xs text-slate-400">
                                  {f.label}: {f.value}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-600">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-3 text-slate-600">
                          {item.unit}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {visibleBuyerQuestions.length > 0 && (
        <CollapsibleSection
          title={dictionary.rfpDetail.buyerQuestionsTitle}
          subtitle={dictionary.rfpDetail.buyerQuestionsSubtitle}
          storageKey="rfp-detail-buyer-questions"
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <ul className="-mx-6 -mb-6 divide-y divide-slate-100 text-sm">
            {visibleBuyerQuestions.map((q) => (
              <li key={q.id} className="px-6 py-3">
                <p className="mb-2 text-slate-700">{q.text}</p>
                <BuyerQuestionForm rfpId={rfp.id} question={q} />
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {supplierQuestions.length > 0 && (
        <CollapsibleSection
          title={dictionary.rfpForm.supplierQuestionsTitle}
          storageKey="rfp-detail-supplier-questions"
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <ul className="-mx-6 -mb-6 divide-y divide-slate-100 text-sm">
            {groupBySection(supplierQuestions).map((group, groupIdx) => (
              <Fragment key={group.name ?? `sin-seccion-${groupIdx}`}>
                {group.name !== null && (
                  <li className="bg-slate-50 px-6 py-2">
                    <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                      {dictionary.rfpForm.sectionPrefix} {group.sectionNumber}
                    </span>
                    <span className="ml-2 text-xs font-medium text-slate-500">
                      {group.name}
                    </span>
                  </li>
                )}
                {group.entries.map(({ item: q, label }) => {
                  const typeLabel = questionTypeLabel(dictionary, q.type);
                  const conditionLabel = q.dependsOnHeaderField
                    ? `${dictionary.rfpDetail.conditionIfField} ${q.dependsOnHeaderField} = "${q.dependsOnValue}"`
                    : q.dependsOnQuestionId
                      ? `${dictionary.rfpDetail.conditionIfOtherQuestion} "${q.dependsOnValue}"`
                      : null;
                  return (
                    <li
                      key={q.id}
                      className="flex items-center justify-between gap-4 px-6 py-3"
                    >
                      <span className="text-slate-700">
                        <span className="mr-2 text-xs font-medium text-slate-400">
                          {label}
                        </span>
                        {q.text}
                        {q.required && !q.isPrerequisite && (
                          <span className="text-red-500"> *</span>
                        )}
                        {conditionLabel && (
                          <span className="ml-2 text-xs text-violet-500">
                            {dictionary.rfpDetail.conditioned}: {conditionLabel}
                          </span>
                        )}
                        {q.respondedBy === "BUYER" && (
                          <span className="ml-2 block text-xs text-slate-500">
                            {dictionary.rfpDetail.buyerAnswerLabel}:{" "}
                            {q.buyerAnswerValue || dictionary.rfpDetail.notAnswered}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                        {q.respondedBy === "BUYER" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                            {dictionary.rfpDetail.buyerAnswers}
                          </span>
                        )}
                        {q.visibility !== "EXTERNAL" && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-medium ${
                              q.visibility === "INTERNAL"
                                ? "bg-slate-200 text-slate-600"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {q.visibility === "INTERNAL"
                              ? dictionary.rfpDetail.internal
                              : dictionary.rfpDetail.supplierOnly}
                          </span>
                        )}
                        {q.isPrerequisite && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                            {dictionary.rfpDetail.prerequisite}
                          </span>
                        )}
                        {dictionary.awardPanel.weightPrefix} {q.weight} &middot; {typeLabel}
                      </span>
                    </li>
                  );
                })}
              </Fragment>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={dictionary.rfpDetail.invitedSuppliersTitle}
        storageKey="rfp-detail-invited-suppliers"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="-mx-6 -mt-4">
          <div className="px-6">
            <InviteSupplierForm
              rfpId={rfp.id}
              supplierDirectory={supplierDirectory}
            />
          </div>
          {rfp.invitations.length === 0 ? (
            <p className="px-6 pt-4 text-sm text-slate-500">
              {dictionary.rfpDetail.noSuppliersInvited}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-2">{dictionary.rfpDetail.supplierColumn}</th>
                    <th className="px-6 py-2">{dictionary.login.email}</th>
                    <th className="px-6 py-2">{dictionary.rfpDetail.statusColumn}</th>
                    <th className="px-6 py-2">{dictionary.rfpDetail.invitedColumn}</th>
                    <th className="px-6 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rfp.invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-6 py-3 font-medium text-slate-800">
                        {inv.supplier.name}
                        <p className="text-xs font-normal text-slate-400">
                          {inv.supplier.company}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {inv.supplier.email}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={inv.status} language={user.language} />
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {formatDateTime(inv.invitedAt, dateOptions)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <CopyLinkButton path={`/respond/${inv.token}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={dictionary.rfpDetail.historyTitle}
        storageKey="rfp-detail-history"
        className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {rfp.status !== "CLOSED" && rfp.invitations.some((i) => i.response) && (
          <p className="mb-3 text-xs text-slate-400">
            {dictionary.rfpDetail.responseDatesHidden}
          </p>
        )}
        <ul className="space-y-2">
          {history.map((h, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-2 text-sm last:border-0"
            >
              <span className="text-slate-700">
                {h.label}
                {h.detail && (
                  <span className="ml-1.5 text-slate-400">— {h.detail}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {formatDateTime(h.date, dateOptions)}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </div>
  );
}
