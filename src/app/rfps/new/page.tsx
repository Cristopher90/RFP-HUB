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
    commodities,
    regions,
    origins,
    supplierDirectory,
    itemCatalog,
  ] = await Promise.all([
    prisma.rfpTemplate.findMany({
      where: { active: true, ...scope.where },
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
      where: { status: "ACTIVE", ...scope.where },
      // Only accepted portal contacts can be invited to an RFP.
      include: {
        userLinks: {
          where: { status: "ACCEPTED" },
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
  const customFields = allCustomFields.filter((f) => f.scope !== "USER");
  const userFields = allCustomFields.filter((f) => f.scope === "USER" && f.mapToRfpKey);
  const prefill: Partial<Record<"buyerName" | "commodity" | "region" | "origin", string>> = {};
  if (customClientId && userFields.length > 0) {
    const mine = (await readCustomValues(customClientId, "USER", [user.id])).get(user.id) ?? {};
    for (const f of userFields) {
      const raw = mine[f.key];
      if (!raw || !f.mapToRfpKey) continue;
      const opt = f.options.find((o) => o.value === raw);
      prefill[f.mapToRfpKey as keyof typeof prefill] = opt ? (opt.labels.es ?? opt.value) : raw;
    }
  }

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
    const built = buildRfpFromRequest(
      request,
      rfpMapping?.mapping,
      commodities,
      customFields,
    );
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
  const hasPrefill = Object.keys(prefill).length > 0;
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
          supplierDirectory={supplierDirectory.map((s) => ({
            ...s,
            contacts: s.userLinks.map((l) => ({
              id: l.supplierUser.id,
              name: `${l.supplierUser.name} ${l.supplierUser.lastName}`.trim(),
              email: l.supplierUser.email,
            })),
          }))}
          itemCatalog={itemCatalog.map((i) => ({
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
            })),
          }))}
        />
      </div>
    </div>
  );
}
