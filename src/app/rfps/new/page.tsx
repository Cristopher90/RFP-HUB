import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { formatRfpNumber } from "@/lib/format";
import { buildItemsFromSourceRfp } from "../rfpActions";
import { getDictionary } from "@/i18n/getDictionary";
import { RfpForm, type RfpInitialData } from "./RfpForm";
import { buildRfpFromRequest } from "@/lib/requestToRfp";
import { buyerGroupIdsOf, canGenerateRfp, visibilityWhere } from "@/lib/requestAccess";
import { deriveRequestStatus } from "@/lib/requestStatus";
import { loadCustomFields, readCustomValues } from "@/lib/customFields";
import { parseTemplateCondition } from "@/lib/templateConditions";
import { loadRatingSummaries, toPickerEntries } from "@/lib/suppliers";
import { loadRfpTags } from "@/lib/rfpTags";
import { loadDocContext } from "@/lib/supplierDocsServer";
import { filterByVisibleCommodity, filterTreeByGroups, viewGroupWhere } from "@/lib/viewGroups";
import { CUSTOM_TARGET_PREFIX, applyViewGroupsToFields, coerceValue } from "@/lib/customFieldsShared";

export default async function NewRfpPage({
  searchParams,
}: PageProps<"/rfps/new">) {
  const scope = await requireClientScope();
  const { user } = scope;
  if (user.role === "APPROVER") redirect("/");
  const dictionary = getDictionary(user.language);
  const sp = await searchParams;
  const copyFrom = typeof sp.copyFrom === "string" ? sp.copyFrom : null;
  const fromRequest = typeof sp.fromRequest === "string" ? sp.fromRequest : null;
  const copyMode =
    sp.mode === "based_on" || sp.mode === "next_round" ? sp.mode : "blank";

  const [
    templates,
    allCommodities,
    allRegions,
    origins,
    supplierDirectory,
    itemCatalog,
  ] = await Promise.all([
    prisma.rfpTemplate.findMany({
      where: { active: true, ...scope.where, ...viewGroupWhere(user) },
      include: {
        items: { orderBy: { order: "asc" } },
        questions: { orderBy: { order: "asc" } },
      },
    }),
    prisma.commodity.findMany({
      where: scope.where,
      orderBy: { description: "asc" },
    }),
    prisma.region.findMany({
      where: scope.where,
      orderBy: { description: "asc" },
    }),
    prisma.origin.findMany({
      where: scope.where,
      orderBy: { description: "asc" },
    }),
    prisma.supplierDirectory.findMany({
      where: { status: "ACTIVE", ...scope.where, ...viewGroupWhere(user) },
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
      where: scope.where,
      include: { catalogList: true },
      orderBy: [{ catalogList: { name: "asc" } }, { code: "asc" }],
    }),
  ]);

  // The client's custom fields (RFP header / line) and, for the user's own
  // custom fields mapped to an RFP field, the values that pre-fill a blank RFP.
  const customClientId = user.clientId ?? null;
  const [allCustomFields, customClient] = customClientId
    ? await Promise.all([
        loadCustomFields(customClientId),
        prisma.client.findUnique({ where: { id: customClientId }, select: { currency: true } }),
      ])
    : [[], null];
  const customFields = applyViewGroupsToFields(
    allCustomFields.filter((f) => f.scope === "RFP_HEAD" || f.scope === "RFP_LINE"),
    user,
  );
  const userFields = allCustomFields.filter((f) => f.scope === "USER" && f.mapToRfpKey);
  const prefill: Partial<Record<"buyerName" | "commodity" | "region" | "origin", string>> = {};
  const customPrefill: Record<string, string> = {};
  if (customClientId && userFields.length > 0) {
    const mine = (await readCustomValues(customClientId, "USER", [user.id])).get(user.id) ?? {};
    for (const f of userFields) {
      const raw = mine[f.key];
      if (!raw || !f.mapToRfpKey) continue;
      const opt = f.options.find((o) => o.value === raw);
      const text = opt ? (opt.labels.es ?? opt.value) : raw;
      if (f.mapToRfpKey.startsWith(CUSTOM_TARGET_PREFIX)) {
        // Copied into one of the RFP's own custom header fields.
        const target = customFields.find(
          (c) => c.scope === "RFP_HEAD" && c.key === f.mapToRfpKey!.slice(CUSTOM_TARGET_PREFIX.length),
        );
        const value = target ? coerceValue(target, text) : "";
        if (target && value !== "") customPrefill[target.key] = value;
      } else {
        prefill[f.mapToRfpKey as keyof typeof prefill] = text;
      }
    }
  }

  const ratingSummaries = user.clientId ? await loadRatingSummaries(user.clientId) : new Map();
  const docContext = user.clientId ? await loadDocContext(user.clientId) : { states: {}, names: {} };

  // View groups: a user with groups only sees the commodities / regions that
  // share one (administrators and users without groups see everything).
  const commodities = filterTreeByGroups(allCommodities, user);
  const regions = filterTreeByGroups(allRegions, user);

  const isNextRound = copyMode === "next_round";
  const carriesHistory = copyMode === "based_on" || isNextRound;

  let initial: RfpInitialData | undefined;
  let purchaseRequestId: string | undefined;
  let purchaseRequestLabel: string | null = null;
  if (fromRequest) {
    // Generating an RFP from a purchase request: only its assigned buyer (or
    // a member of the assigned group) may, and only while it's still new.
    const groupIds = await buyerGroupIdsOf(user.id);
    const request = await prisma.purchaseRequest.findFirst({
      where: {
        id: fromRequest,
        ...(scope.isSuperAdmin ? {} : { clientId: user.clientId as string }),
        ...(visibilityWhere(user, groupIds) as object),
      },
      include: {
        lines: { orderBy: { order: "asc" } },
        rfp: { select: { status: true, awardedInvitationId: true } },
      },
    });
    if (
      !request ||
      !canGenerateRfp(request, user.id, groupIds) ||
      deriveRequestStatus(request) !== "NEW"
    ) {
      redirect("/requests");
    }
    // How a request fills the RFP is a per-client setting (Settings → Request to RFP mapping).
    const rfpMapping = await prisma.requestRfpMapping.findUnique({
      where: { clientId: request.clientId },
    });
    // The request's own custom fields can feed RFP fields through the mapping.
    const requestFields = (await loadCustomFields(request.clientId)).filter(
      (f) => f.scope === "REQUEST_HEAD" || f.scope === "REQUEST_LINE",
    );
    const [requestHeader, requestLines] =
      requestFields.length > 0
        ? await Promise.all([
            readCustomValues(request.clientId, "REQUEST", [request.id]),
            readCustomValues(request.clientId, "REQUEST_LINE", request.lines.map((l) => l.id)),
          ])
        : [new Map<string, Record<string, string>>(), new Map<string, Record<string, string>>()];
    const built = buildRfpFromRequest(request, rfpMapping?.mapping, commodities, customFields, {
      fields: requestFields,
      header: requestHeader.get(request.id) ?? {},
      lines: request.lines.map((l) => requestLines.get(l.id) ?? {}),
    });
    purchaseRequestId = request.id;
    purchaseRequestLabel = `${request.documentType} ${request.documentNumber}`;
    initial = {
      title: built.title,
      description: built.description,
      buyerName: user.name,
      deadlineAt: "",
      commodity: built.commodity,
      region: "",
      startDate: "",
      estimatedPrice: built.estimatedPrice,
      origin: "",
      predecessorDocument: built.predecessorDocument,
      basedOnRfpId: null,
      basedOnRfpLabel: null,
      selectedTemplateId: null,
      customValues: built.customValues,
      scoringEnabled: false,
      items: built.items,
      questions: [],
      internalQuestions: [],
      suppliers: [],
    };
  } else if (copyFrom) {
    // "Siguiente ronda" copies exactly like "basar en RFP anterior" (mismos
    // artículos/proveedores, precio histórico) — solo se marca isNextRound
    // para que createRfp numere y encadene la ronda.
    const result = await buildItemsFromSourceRfp(
      copyFrom,
      carriesHistory ? "based_on" : "blank",
    );
    if (!("error" in result)) {
      initial = {
        title: isNextRound
          ? result.sourceTitle
          : `Copia de ${result.sourceTitle}`,
        description: "",
        buyerName: user.name,
        deadlineAt: "",
        commodity: result.sourceCommodity ?? "",
        region: result.sourceRegion ?? "",
        startDate: "",
        estimatedPrice:
          result.sourceEstimatedPrice != null ? String(result.sourceEstimatedPrice) : "",
        origin: "",
        predecessorDocument: "",
        basedOnRfpId: carriesHistory ? copyFrom : null,
        basedOnRfpLabel: carriesHistory
          ? `${formatRfpNumber(result.sourceNumber)} — ${result.sourceTitle}`
          : null,
        selectedTemplateId: result.sourceSelectedTemplateId,
        customValues: result.sourceCustomValues,
        isNextRound,
        scoringEnabled: false,
        items: result.items,
        questions: result.questions,
        internalQuestions: result.internalQuestions,
        suppliers: result.suppliers,
      };
    }
  }

  // A blank RFP starts with whatever the user's mapped custom fields provide.
  const hasPrefill = Object.keys(prefill).length > 0 || Object.keys(customPrefill).length > 0;
  if (!initial && hasPrefill) {
    const pick = (key: "commodity" | "region" | "origin") => {
      const v = prefill[key] ?? "";
      const list = key === "commodity" ? commodities : key === "region" ? regions : origins;
      return list.some((x) => x.description === v) ? v : "";
    };
    initial = {
      title: "",
      description: "",
      buyerName: prefill.buyerName || user.name,
      deadlineAt: "",
      commodity: pick("commodity"),
      region: pick("region"),
      startDate: "",
      estimatedPrice: "",
      origin: pick("origin"),
      predecessorDocument: "",
      basedOnRfpId: null,
      basedOnRfpLabel: null,
      selectedTemplateId: null,
      customValues: customPrefill,
      scoringEnabled: false,
      items: [],
      questions: [],
      internalQuestions: [],
      suppliers: [],
    };
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.newRfpPage.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.newRfpPage.subtitle}
      </p>
      {purchaseRequestLabel && (
        <p className="mt-2 inline-block rounded-md bg-violet-50 px-3 py-1 text-sm text-violet-700">
          {dictionary.newRfpPage.fromRequestPrefix} {purchaseRequestLabel}
        </p>
      )}
      <div className="mt-8">
        <RfpForm
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
          supplierDocStates={docContext.states}
          docTypeNames={docContext.names}
          existingTags={await loadRfpTags(scope.where)}
          initial={initial}
          purchaseRequestId={purchaseRequestId}
          seedTemplates={hasPrefill && !purchaseRequestId}
          customFields={customFields}
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
            documentRequirements: t.documentRequirements,
            defaultDeadlineDays: t.defaultDeadlineDays,
            priority: t.priority,
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
