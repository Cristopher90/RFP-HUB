import { splitTags } from "@/lib/tags";
import { unmetRequirements } from "@/lib/supplierDocs";
import { rfpDocumentRequirements, validDocTypesBySupplier } from "@/lib/supplierDocsServer";
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
import { TeamSection } from "./TeamSection";
import { EditPublishedButton } from "./EditPublishedButton";
import { BUYER_ROLES } from "@/lib/requestFields";
import { canManageTeam, rfpAccess } from "@/lib/rfpAccess";
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
import { loadCustomFields, readCustomValues } from "@/lib/customFields";
import { viewGroupWhere } from "@/lib/viewGroups";
import { loadRatingSummaries, toPickerEntries } from "@/lib/suppliers";
import { applyViewGroupsToFields, displayValue, labelFor } from "@/lib/customFieldsShared";

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
        client: { select: { currency: true } },
      },
    }),
    requireClientScope(),
  ]);

  if (!rfp) notFound();
  if (!scope.isSuperAdmin && rfp.clientId !== scope.user.clientId) notFound();
  const user = scope.user;
  // Only the creator, the RFP's team, involved approvers and administrators may open it.
  const access = await rfpAccess(user, rfp);
  if (!access) notFound();
  const canEdit = access === "edit";
  const manageTeam = canManageTeam(user, rfp);
  const [teamMembers, ownerUser, teamCandidates] = await Promise.all([
    prisma.rfpMember.findMany({
      where: { rfpId: rfp.id },
      include: { user: { select: { name: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    rfp.createdByUserId
      ? prisma.user.findUnique({ where: { id: rfp.createdByUserId }, select: { name: true, lastName: true, email: true } })
      : null,
    manageTeam
      ? prisma.user.findMany({
          where: { clientId: rfp.clientId, role: { in: [...BUYER_ROLES] }, id: { not: rfp.createdByUserId ?? "" } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, lastName: true, email: true },
        })
      : [],
  ]);
  const memberIds = new Set(teamMembers.map((m) => m.userId));
  const personName = (u: { name: string; lastName: string | null }) => `${u.name} ${u.lastName ?? ""}`.trim();
  rfp.status = await syncAwaitingStart(rfp);
  const locale = localeForLanguage(user.language);
  const dictionary = getDictionary(user.language);
  // The client's custom fields with this RFP's stored values (header and lines).
  const [allCustomFieldDefs, customHeaderMap, customLineMap] = await Promise.all([
    loadCustomFields(rfp.clientId, undefined, false),
    readCustomValues(rfp.clientId, "RFP", [rfp.id]),
    readCustomValues(rfp.clientId, "RFP_LINE", rfp.items.map((i) => i.id)),
  ]);
  // Fields hidden from this viewer by view groups are not displayed.
  const customFieldDefs = applyViewGroupsToFields(allCustomFieldDefs, user);
  const customHeaderValues = customHeaderMap.get(rfp.id) ?? {};
  const dateOptions = { locale, timeZone: user.timezone };
  // Currency is derived from the RFP's owning client, not the viewer's
  // personal preference — otherwise the same stored amount could show a
  // different currency code to different people looking at it (e.g. two
  // approvers with different `currency` settings).
  const currencyOptions = { locale, currency: rfp.client.currency };

  const supplierDirectoryRaw = await prisma.supplierDirectory.findMany({
    where: { status: "ACTIVE", clientId: rfp.clientId, ...viewGroupWhere(user) },
    // Only accepted portal contacts can be invited to an RFP.
      include: {
        userLinks: {
          where: { status: "ACCEPTED", blocked: false },
          include: { supplierUser: true },
          orderBy: { supplierUser: { name: "asc" } },
        },
      },
    orderBy: { companyName: "asc" },
  });
  // Suppliers lacking the valid documentation the RFP's templates demand can't be invited.
  const docRequirements = await rfpDocumentRequirements(rfp.id);
  const validDocs = docRequirements.length > 0 ? await validDocTypesBySupplier(rfp.clientId) : new Map<string, Set<string>>();
  const supplierDirectory = toPickerEntries(supplierDirectoryRaw, await loadRatingSummaries(rfp.clientId)).map((s) => ({
    ...s,
    docIssue:
      docRequirements.length > 0 && unmetRequirements(docRequirements, validDocs.get(s.id) ?? new Set()).length > 0,
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
  // Changes recorded as they happen (team, edits, reopenings...).
  const ev = dictionary.rfpEvents;
  const permissionText = (p: unknown) => (p === "EDIT" ? dictionary.rfpTeam.canEdit : dictionary.rfpTeam.canView);
  for (const e of await prisma.rfpEvent.findMany({
    where: { rfpId: rfp.id },
    include: { user: { select: { name: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  })) {
    const d = (e.detail ?? {}) as Record<string, unknown>;
    const name = String(d.name ?? "");
    let label: string;
    switch (e.kind) {
      case "TEAM_ADDED":
        label = ev.teamAdded.replace("{name}", name).replace("{permission}", permissionText(d.permission));
        break;
      case "TEAM_REMOVED":
        label = ev.teamRemoved.replace("{name}", name);
        break;
      case "TEAM_PERMISSION":
        label = ev.teamPermission.replace("{name}", name).replace("{permission}", permissionText(d.permission));
        break;
      case "EDITED": {
        const fields = (Array.isArray(d.fields) ? d.fields : []) as string[];
        label = ev.edited.replace(
          "{changes}",
          fields.map((f) => (ev.fields as Record<string, string>)[f] ?? f).join(", "),
        );
        break;
      }
      case "RETURNED_TO_DRAFT":
        label = ev.returnedToDraft.replace("{count}", String(d.responses ?? 0));
        break;
      case "REOPENED":
        label = ev.reopened;
        break;
      case "SUPPLIER_INVITED":
        label = ev.supplierInvited.replace("{name}", name);
        break;
      case "AWARD_REVOKED":
        label = ev.awardRevoked;
        break;
      default:
        continue;
    }
    history.push({
      date: e.createdAt,
      label,
      detail: e.user ? `${e.user.name} ${e.user.lastName ?? ""}`.trim() : undefined,
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
      { commodity: rfp.commodity, region: rfp.region, custom: customHeaderValues },
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
          {canEdit && rfp.status === "DRAFT" && <DraftActions rfpId={rfp.id} />}
          {canEdit && rfp.status !== "DRAFT" && rfp.status !== "DELETED" && (
            <EditPublishedButton rfpId={rfp.id} responseCount={rfp.invitations.filter((i) => i.response).length} />
          )}
          {canEdit &&
            (rfp.status === "OPEN" ||
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

      {rfp.internalNotes && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-700">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            {dictionary.rfpForm.internalNotesLabel}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {splitTags(rfp.internalNotes).map((seg, i) =>
              seg.type === "text" ? (
                <span key={i}>{seg.text}</span>
              ) : (
                <Link
                  key={i}
                  href={`/?tab=all&tag=${encodeURIComponent(seg.tag)}`}
                  className="rounded bg-violet-100 px-1 font-medium text-violet-700 hover:bg-violet-200"
                >
                  {seg.raw}
                </Link>
              ),
            )}
          </p>
        </div>
      )}

      <TeamSection
        rfpId={rfp.id}
        owner={ownerUser ? { name: personName(ownerUser), email: ownerUser.email } : null}
        members={teamMembers.map((m) => ({
          id: m.id,
          name: personName(m.user),
          email: m.user.email,
          permission: m.permission,
        }))}
        candidates={teamCandidates
          .filter((u) => !memberIds.has(u.id))
          .map((u) => ({ id: u.id, name: personName(u), email: u.email }))}
        canManage={manageTeam}
      />

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
        {customFieldDefs
          .filter((f) => f.scope === "RFP_HEAD" && f.visible && customHeaderValues[f.key] !== undefined)
          .map((f) => (
            <div key={f.key}>
              <p className="text-xs text-slate-400">{labelFor(f.labels, user.language, f.key)}</p>
              <p className="font-medium text-slate-700">
                {displayValue(
                  f,
                  customHeaderValues[f.key],
                  user.language,
                  (n) => formatCurrency(n, currencyOptions),
                  dictionary.customFields.yes,
                  dictionary.customFields.no,
                ) || "—"}
              </p>
            </div>
          ))}
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
                          {(customFields.length > 0 || customLineMap.has(item.id)) && (
                            <ul className="mt-1 space-y-0.5">
                              {customFields.map((f, i) => (
                                <li key={i} className="text-xs text-slate-400">
                                  {f.label}: {f.value}
                                </li>
                              ))}
                              {customFieldDefs
                                .filter(
                                  (f) =>
                                    f.scope === "RFP_LINE" &&
                                    f.visible &&
                                    customLineMap.get(item.id)?.[f.key] !== undefined,
                                )
                                .map((f) => (
                                  <li key={f.key} className="text-xs text-slate-400">
                                    {labelFor(f.labels, user.language, f.key)}:{" "}
                                    {displayValue(
                                      f,
                                      customLineMap.get(item.id)?.[f.key],
                                      user.language,
                                      (n) => formatCurrency(n, currencyOptions),
                                      dictionary.customFields.yes,
                                      dictionary.customFields.no,
                                    )}
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
                {canEdit && <BuyerQuestionForm rfpId={rfp.id} question={q} />}
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
          {canEdit &&
            (rfp.status === "DRAFT" ? (
              <div className="px-6">
                <InviteSupplierForm
                  rfpId={rfp.id}
                  supplierDirectory={supplierDirectory}
                />
              </div>
            ) : (
              <p className="px-6 text-xs text-slate-400">{dictionary.rfpDetail.invitesOnlyInDraft}</p>
            ))}
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
        defaultOpen={false}
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
