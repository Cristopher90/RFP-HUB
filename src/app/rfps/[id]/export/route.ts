import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import {
  ITEM_SHEET_NAME,
  QUESTION_SHEET_NAME,
  boolToLabel,
  respondedByToLabel,
  typeToLabel,
  visibilityToLabel,
  type ItemRow,
  type QuestionRow,
} from "@/lib/excelSchema";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/rfps/[id]/export">,
) {
  const scope = await requireClientScope();
  const { id } = await params;

  const rfp = await prisma.rfp.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
    },
  });

  if (!rfp || (!scope.isSuperAdmin && rfp.clientId !== scope.user.clientId)) {
    return NextResponse.json({ error: "RFP no encontrada" }, { status: 404 });
  }

  const questionTextById = new Map(rfp.questions.map((q) => [q.id, q.text]));

  const itemRows: ItemRow[] = rfp.items.map((i) => {
    const customFields = i.customFields
      ? (JSON.parse(i.customFields) as { label: string; value: string }[])
      : [];
    return {
      Seccion: i.section ?? "",
      Codigo: i.code ?? "",
      Nombre: i.name,
      Descripcion: i.description ?? "",
      Cantidad: i.quantity,
      Unidad: i.unit,
      Peso: i.weight,
      Decimales: i.decimals,
      CamposAdicionales: customFields
        .map((f) => `${f.label}:${f.value}`)
        .join("; "),
    };
  });

  const questionRows: QuestionRow[] = rfp.questions.map((q) => ({
    Seccion: q.section ?? "",
    Texto: q.text,
    Tipo: typeToLabel(q.type),
    Opciones: q.options ? (JSON.parse(q.options) as string[]).join(", ") : "",
    Obligatoria: boolToLabel(q.required),
    Peso: q.weight,
    EsPrerrequisito: boolToLabel(q.isPrerequisite),
    QuienResponde: respondedByToLabel(q.respondedBy),
    Visibilidad: visibilityToLabel(q.visibility),
    NumeroMin: q.numberMin ?? "",
    NumeroMax: q.numberMax ?? "",
    CondicionTipo: q.dependsOnHeaderField
      ? q.dependsOnHeaderField === "commodity"
        ? "Commodity"
        : "Region"
      : q.dependsOnQuestionId
        ? "Pregunta"
        : "Ninguna",
    CondicionValor: q.dependsOnValue ?? "",
    CondicionPreguntaTexto: q.dependsOnQuestionId
      ? (questionTextById.get(q.dependsOnQuestionId) ?? "")
      : "",
    RespuestaComprador: q.respondedBy === "BUYER" ? (q.buyerAnswerValue ?? "") : "",
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(itemRows),
    ITEM_SHEET_NAME,
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(questionRows),
    QUESTION_SHEET_NAME,
  );

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  const filename = `${rfp.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "rfp"}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
