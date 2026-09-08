import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRfpNumber } from "@/lib/format";
import { RfpForm, type RfpInitialData } from "../../new/RfpForm";
import type {
  NewItemInput,
  NewQuestionInput,
  NewSupplierInput,
} from "../../new/actions";

export default async function EditRfpPage({
  params,
}: PageProps<"/rfps/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser();

  const [
    rfp,
    templates,
    commodities,
    regions,
    origins,
    supplierDirectory,
    itemCatalog,
    creators,
  ] = await Promise.all([
    prisma.rfp.findUnique({
      where: { id },
      include: {
        items: { orderBy: { order: "asc" } },
        questions: { orderBy: { order: "asc" } },
        invitations: { include: { supplier: true } },
        basedOnRfp: { select: { number: true, title: true } },
      },
    }),
    prisma.rfpTemplate.findMany({
      where: { active: true },
      include: {
        items: { orderBy: { order: "asc" } },
        questions: { orderBy: { order: "asc" } },
      },
    }),
    prisma.commodity.findMany({ orderBy: { description: "asc" } }),
    prisma.region.findMany({ orderBy: { description: "asc" } }),
    prisma.origin.findMany({ orderBy: { description: "asc" } }),
    prisma.supplierDirectory.findMany({
      where: { status: "ACTIVE" },
      orderBy: { companyName: "asc" },
    }),
    prisma.itemCatalog.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!rfp) notFound();
  if (rfp.status !== "DRAFT") redirect(`/rfps/${rfp.id}`);

  function toDateInput(date: Date | null) {
    if (!date) return "";
    return date.toISOString().slice(0, 10);
  }

  function toDatetimeLocalInput(date: Date | null) {
    if (!date) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
    sourceTemplateItemId: i.sourceTemplateItemId,
    locked: i.locked,
  }));

  function mapQuestions(
    respondedBy: "SUPPLIER" | "BUYER",
  ): NewQuestionInput[] {
    return rfp!.questions
      .filter((q) => q.respondedBy === respondedBy)
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
  }));

  const initial: RfpInitialData = {
    title: rfp.title,
    description: rfp.description,
    buyerName: rfp.buyerName,
    deadlineAt: toDatetimeLocalInput(rfp.deadlineAt),
    commodity: rfp.commodity ?? "",
    region: rfp.region ?? "",
    startDate: toDateInput(rfp.startDate),
    estimatedPrice: rfp.estimatedPrice != null ? String(rfp.estimatedPrice) : "",
    origin: rfp.origin ?? "",
    predecessorDocument: rfp.predecessorDocument ?? "",
    basedOnRfpId: rfp.basedOnRfpId,
    basedOnRfpLabel: rfp.basedOnRfp
      ? `${formatRfpNumber(rfp.basedOnRfp.number)} — ${rfp.basedOnRfp.title}`
      : null,
    scoringEnabled: rfp.scoringEnabled,
    items,
    questions: mapQuestions("SUPPLIER"),
    internalQuestions: mapQuestions("BUYER"),
    suppliers,
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Editar {formatRfpNumber(rfp.number)}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Solo se puede editar mientras la RFP esté en borrador.
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
          supplierDirectory={supplierDirectory}
          itemCatalog={itemCatalog}
          creators={creators}
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
              lockMinRole: i.lockMinRole,
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
              lockMinRole: q.lockMinRole,
            })),
          }))}
        />
      </div>
    </div>
  );
}
