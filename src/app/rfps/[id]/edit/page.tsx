import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { formatRfpNumber } from "@/lib/format";
import { utcToZonedTime } from "@/lib/timezone";
import { RfpForm, type RfpInitialData } from "../../new/RfpForm";
import { getDictionary } from "@/i18n/getDictionary";
import { loadCustomFields, readCustomValues } from "@/lib/customFields";
import { parseTemplateCondition } from "@/lib/templateConditions";
import { applyViewGroupsToFields } from "@/lib/customFieldsShared";
import { filterByVisibleCommodity, filterTreeByGroups, viewGroupWhere } from "@/lib/viewGroups";
import { loadRatingSummaries, toPickerEntries } from "@/lib/suppliers";
import type {
  NewItemInput,
  NewQuestionInput,
  NewSupplierInput,
} from "../../new/actions";

export default async function EditRfpPage({
  params,
}: PageProps<"/rfps/[id]/edit">) {
  const { id } = await params;
  const scope = await requireClientScope();
  const { user } = scope;

  const rfp = await prisma.rfp.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
      invitations: { include: { supplier: true } },
      basedOnRfp: { select: { number: true, title: true } },
    },
  });
  if (!rfp) notFound();
  if (!scope.isSuperAdmin && rfp.clientId !== user.clientId) notFound();
  if (rfp.status !== "DRAFT") redirect(`/rfps/${rfp.id}`);
  const dictionary = getDictionary(user.language);

  const rfpWhere = { clientId: rfp.clientId };
  const [templates, allCommodities, allRegions, origins, supplierDirectory, itemCatalog] =
    await Promise.all([
      prisma.rfpTemplate.findMany({
        where: { active: true, ...rfpWhere, ...viewGroupWhere(user) },
        include: {
          items: { orderBy: { order: "asc" } },
          questions: { orderBy: { order: "asc" } },
        },
      }),
      prisma.commodity.findMany({ where: rfpWhere, orderBy: { description: "asc" } }),
      prisma.region.findMany({ where: rfpWhere, orderBy: { description: "asc" } }),
      prisma.origin.findMany({ where: rfpWhere, orderBy: { description: "asc" } }),
      prisma.supplierDirectory.findMany({
        where: { status: "ACTIVE", ...rfpWhere, ...viewGroupWhere(user) },
        // Only accepted portal contacts can be invited to an RFP.
      include: {
        userLinks: {
          where: { status: "ACCEPTED", blocked: false },
          include: { supplierUser: true },
          orderBy: { supplierUser: { name: "asc" } },
        },
      },
        orderBy: { companyName: "asc" },
      }),
      prisma.itemCatalogEntry.findMany({
        where: rfpWhere,
        include: { catalogList: true },
        orderBy: [{ catalogList: { name: "asc" } }, { code: "asc" }],
      }),
    ]);

  const commodities = filterTreeByGroups(allCommodities, user);
  const regions = filterTreeByGroups(allRegions, user);
  const ratingSummaries = await loadRatingSummaries(rfp.clientId);

  const [customFields, customClient, headerValues, lineValues] = await Promise.all([
    loadCustomFields(rfp.clientId),
    prisma.client.findUnique({ where: { id: rfp.clientId }, select: { currency: true } }),
    readCustomValues(rfp.clientId, "RFP", [rfp.id]),
    readCustomValues(rfp.clientId, "RFP_LINE", rfp.items.map((i) => i.id)),
  ]);

  function toDatetimeLocalInput(date: Date | null) {
    if (!date) return "";
    return utcToZonedTime(date, user.timezone);
  }

  const items: NewItemInput[] = rfp.items.map((i) => ({
    id: i.id,
    section: i.section,
    code: i.code,
    name: i.name,
    description: i.description ?? "",
    quantity: i.quantity,
    unit: i.unit,
    weight: i.weight,
    decimals: i.decimals,
    historicalPrice: i.historicalPrice,
    commodity: i.commodity,
    customFields: i.customFields
      ? (JSON.parse(i.customFields) as { label: string; value: string }[])
      : [],
    customValues: lineValues.get(i.id) ?? {},
    sourceTemplateItemId: i.sourceTemplateItemId,
    locked: i.locked,
    sourceItemCatalogEntryId: i.sourceItemCatalogEntryId,
  }));

  function mapQuestions(
    area: "EXTERNAL" | "INTERNAL",
  ): NewQuestionInput[] {
    return rfp!.questions
      .filter((q) =>
        area === "INTERNAL"
          ? q.visibility === "INTERNAL"
          : q.visibility !== "INTERNAL",
      )
      .map((q) => ({
        // La propia id de la pregunta sirve como clientKey estable: ya es
        // el id real, así dependsOnQuestionId se puede reusar tal cual.
        id: q.id,
        clientKey: q.id,
        section: q.section,
        text: q.text,
        type: q.type,
        options: q.options ? (JSON.parse(q.options) as string[]) : [],
        required: q.required,
        weight: q.weight,
        isPrerequisite: q.isPrerequisite,
        visibility: q.visibility,
        respondedBy: q.respondedBy,
        numberMin: q.numberMin,
        numberMax: q.numberMax,
        scoringConfig: q.scoringConfig
          ? (JSON.parse(q.scoringConfig) as Record<string, number>)
          : null,
        dependsOnQuestionKey: q.dependsOnQuestionId,
        dependsOnHeaderField: q.dependsOnHeaderField as
          | "commodity"
          | "region"
          | null,
        dependsOnValue: q.dependsOnValue ?? "",
        buyerAnswerValue: q.buyerAnswerValue ?? "",
        sourceTemplateQuestionId: q.sourceTemplateQuestionId,
        locked: q.locked,
      }));
  }

  const suppliers: NewSupplierInput[] = rfp.invitations.map((inv) => ({
    invitationId: inv.id,
    name: inv.supplier.name,
    email: inv.supplier.email,
    company: inv.supplier.company,
    supplierDirectoryId: inv.supplier.supplierDirectoryId,
  }));

  const initial: RfpInitialData = {
    title: rfp.title,
    description: rfp.description,
    buyerName: rfp.buyerName,
    deadlineAt: toDatetimeLocalInput(rfp.deadlineAt),
    commodity: rfp.commodity ?? "",
    region: rfp.region ?? "",
    startDate: toDatetimeLocalInput(rfp.startDate),
    estimatedPrice: rfp.estimatedPrice != null ? String(rfp.estimatedPrice) : "",
    origin: rfp.origin ?? "",
    predecessorDocument: rfp.predecessorDocument ?? "",
    basedOnRfpId: rfp.basedOnRfpId,
    basedOnRfpLabel: rfp.basedOnRfp
      ? `${formatRfpNumber(rfp.basedOnRfp.number)} — ${rfp.basedOnRfp.title}`
      : null,
    selectedTemplateId: rfp.selectedTemplateId,
    customValues: headerValues.get(rfp.id) ?? {},
    scoringEnabled: rfp.scoringEnabled,
    items,
    questions: mapQuestions("EXTERNAL"),
    internalQuestions: mapQuestions("INTERNAL"),
    suppliers,
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {dictionary.editRfpPage.editPrefix} {formatRfpNumber(rfp.number)}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.editRfpPage.subtitle}
      </p>
      <div className="mt-8">
        <RfpForm
          mode="edit"
          rfpId={rfp.id}
          initial={initial}
          currentUserRole={user.role}
          currentUserName={user.name}
          commodities={commodities}
          regions={regions}
          origins={origins}
          supplierDirectory={toPickerEntries(supplierDirectory, ratingSummaries)}
          itemCatalog={filterByVisibleCommodity(itemCatalog, allCommodities, commodities).map((i) => ({
            id: i.id,
            catalogName: i.catalogList.name,
            code: i.code,
            name: i.name,
            description: i.description,
            unit: i.unit,
            commodity: i.commodity,
            lastPrice: i.lastPrice,
          }))}
          allowFreeTextItems={user.allowFreeTextItems}
          customFields={applyViewGroupsToFields(
            customFields.filter((f) => f.scope === "RFP_HEAD" || f.scope === "RFP_LINE"),
            user,
          )}
          clientCurrency={customClient?.currency ?? "USD"}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            matchCommodity: t.matchCommodity,
            matchCommodityIncludeDescendants: t.matchCommodityIncludeDescendants,
            matchRegion: t.matchRegion,
            matchRegionIncludeDescendants: t.matchRegionIncludeDescendants,
            matchPriceCondition: t.matchPriceCondition,
            matchPriceMin: t.matchPriceMin,
            matchPriceMax: t.matchPriceMax,
            matchCustom: t.matchCustom,
            items: t.items.map((i) => ({
              id: i.id,
              section: i.section,
              name: i.name,
              description: i.description ?? "",
              quantity: i.quantity,
              unit: i.unit,
              weight: i.weight,
              decimals: i.decimals,
              customFields: i.customFields
                ? (JSON.parse(i.customFields) as {
                    label: string;
                    value: string;
                  }[])
                : [],
              lockRoles: i.lockRoles,
              condition: parseTemplateCondition(i.condition),
              sectionCondition: parseTemplateCondition(i.sectionCondition),
            })),
            questions: t.questions.map((q) => ({
              id: q.id,
              section: q.section,
              text: q.text,
              type: q.type,
              options: q.options ? (JSON.parse(q.options) as string[]) : [],
              required: q.required,
              weight: q.weight,
              isPrerequisite: q.isPrerequisite,
              visibility: q.visibility,
              respondedBy: q.respondedBy,
              numberMin: q.numberMin,
              numberMax: q.numberMax,
              scoringConfig: q.scoringConfig
                ? (JSON.parse(q.scoringConfig) as Record<string, number>)
                : null,
              lockRoles: q.lockRoles,
              dependsOnHeaderField: q.dependsOnHeaderField,
              dependsOnValue: q.dependsOnValue,
              sectionCondition: parseTemplateCondition(q.sectionCondition),
            })),
          }))}
        />
      </div>
    </div>
  );
}
