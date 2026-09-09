import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { formatRfpNumber } from "@/lib/format";
import { buildItemsFromSourceRfp } from "../rfpActions";
import { RfpForm, type RfpInitialData } from "./RfpForm";

export default async function NewRfpPage({
  searchParams,
}: PageProps<"/rfps/new">) {
  const scope = await requireClientScope();
  const { user } = scope;
  if (user.role === "APPROVER") redirect("/");
  const sp = await searchParams;
  const copyFrom = typeof sp.copyFrom === "string" ? sp.copyFrom : null;
  const copyMode =
    sp.mode === "based_on" || sp.mode === "next_round" ? sp.mode : "blank";

  const [
    templates,
    commodities,
    regions,
    origins,
    supplierDirectory,
    itemCatalog,
    creators,
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
      include: { supplierUsers: { orderBy: { name: "asc" } } },
      orderBy: { companyName: "asc" },
    }),
    prisma.itemCatalogEntry.findMany({
      where: scope.where,
      include: { catalogList: true },
      orderBy: [{ catalogList: { name: "asc" } }, { code: "asc" }],
    }),
    prisma.user.findMany({
      where: scope.where,
      orderBy: { name: "asc" },
    }),
  ]);

  const isNextRound = copyMode === "next_round";
  const carriesHistory = copyMode === "based_on" || isNextRound;

  let initial: RfpInitialData | undefined;
  if (copyFrom) {
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
        commodity: "",
        region: "",
        startDate: "",
        estimatedPrice: "",
        origin: "",
        predecessorDocument: "",
        basedOnRfpId: carriesHistory ? copyFrom : null,
        basedOnRfpLabel: carriesHistory
          ? `${formatRfpNumber(result.sourceNumber)} — ${result.sourceTitle}`
          : null,
        isNextRound,
        scoringEnabled: false,
        items: result.items,
        questions: result.questions,
        internalQuestions: result.internalQuestions,
        suppliers: result.suppliers,
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva RFP</h1>
      <p className="mt-1 text-sm text-slate-500">
        Define los artículos, las preguntas para los proveedores y a quién
        invitar a cotizar.
      </p>
      <div className="mt-8">
        <RfpForm
          currentUserRole={user.role}
          currentUserName={user.name}
          commodities={commodities}
          regions={regions}
          origins={origins}
          supplierDirectory={supplierDirectory.map((s) => ({
            ...s,
            contacts: s.supplierUsers.map((u) => ({
              id: u.id,
              name: `${u.name} ${u.lastName}`.trim(),
              email: u.email,
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
          creators={creators}
          initial={initial}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            matchCommodity: t.matchCommodity,
            matchRegion: t.matchRegion,
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
              lockRoles: q.lockRoles,
            })),
          }))}
        />
      </div>
    </div>
  );
}
