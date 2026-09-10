import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { makeClientKey } from "@/lib/clientKey";
import { TemplateForm } from "../TemplateForm";
import { deleteTemplate } from "../actions";

export default async function EditTemplatePage({
  params,
}: PageProps<"/admin/templates/[id]">) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const { id } = await params;

  const template = await prisma.rfpTemplate.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!template) notFound();
  if (!scope.isSuperAdmin && template.clientId !== scope.user.clientId) {
    notFound();
  }

  const [commodities, regions] = await Promise.all([
    prisma.commodity.findMany({
      where: { clientId: template.clientId },
      orderBy: { description: "asc" },
    }),
    prisma.region.findMany({
      where: { clientId: template.clientId },
      orderBy: { description: "asc" },
    }),
  ]);

  const questionClientKeyById = new Map(
    template.questions.map((q) => [q.id, makeClientKey()]),
  );

  const initial = {
    name: template.name,
    description: template.description ?? "",
    matchCommodity: template.matchCommodity ?? "",
    matchRegion: template.matchRegion ?? "",
    active: template.active,
    hideResponsesUntilClosed: template.hideResponsesUntilClosed,
    items: template.items.map((i) => ({
      id: i.id,
      section: i.section,
      name: i.name,
      description: i.description ?? "",
      quantity: i.quantity,
      unit: i.unit,
      weight: i.weight,
      decimals: i.decimals,
      customFields: i.customFields
        ? (JSON.parse(i.customFields) as { label: string; value: string }[])
        : [],
      lockRoles: i.lockRoles,
    })),
    questions: template.questions.map((q) => ({
      id: q.id,
      clientKey: questionClientKeyById.get(q.id)!,
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
      dependsOnQuestionKey: q.dependsOnQuestionId
        ? (questionClientKeyById.get(q.dependsOnQuestionId) ?? null)
        : null,
      dependsOnHeaderField: q.dependsOnHeaderField as
        | "commodity"
        | "region"
        | null,
      dependsOnValue: q.dependsOnValue ?? "",
      lockRoles: q.lockRoles,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; Configuración
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Editar plantilla &middot; {template.name}
          </h1>
        </div>
        <form
          action={async () => {
            "use server";
            await deleteTemplate(template.id);
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Eliminar plantilla
          </button>
        </form>
      </div>
      <div className="mt-8">
        <TemplateForm
          templateId={template.id}
          initial={initial}
          commodities={commodities}
          regions={regions}
        />
      </div>
    </div>
  );
}
