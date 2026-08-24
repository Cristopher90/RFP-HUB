import * as XLSX from "xlsx";
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
import type { NewItemInput, NewQuestionInput } from "./actions";

// Builds the same workbook shape as the server-side export route, but from
// the form's in-memory state — so a buyer can grab a working example (or
// export what they've built so far) before the RFP is even saved.
export function buildRfpExcelWorkbook(
  items: NewItemInput[],
  questions: NewQuestionInput[],
) {
  const questionTextByKey = new Map(questions.map((q) => [q.clientKey, q.text]));

  const itemRows: ItemRow[] = items.map((i) => ({
    Seccion: i.section ?? "",
    Codigo: i.code ?? "",
    Nombre: i.name,
    Descripcion: i.description ?? "",
    Cantidad: i.quantity,
    Unidad: i.unit,
    Peso: i.weight,
    Decimales: i.decimals,
    CamposAdicionales: i.customFields
      .map((f) => `${f.label}:${f.value}`)
      .join("; "),
  }));

  const questionRows: QuestionRow[] = questions.map((q) => ({
    Seccion: q.section ?? "",
    Texto: q.text,
    Tipo: typeToLabel(q.type),
    Opciones: q.options.join(", "),
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
      : q.dependsOnQuestionKey
        ? "Pregunta"
        : "Ninguna",
    CondicionValor: q.dependsOnValue ?? "",
    CondicionPreguntaTexto: q.dependsOnQuestionKey
      ? (questionTextByKey.get(q.dependsOnQuestionKey) ?? "")
      : "",
    RespuestaComprador: q.respondedBy === "BUYER" ? q.buyerAnswerValue : "",
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
  return workbook;
}

export function downloadRfpExcel(
  filename: string,
  items: NewItemInput[],
  questions: NewQuestionInput[],
) {
  const workbook = buildRfpExcelWorkbook(items, questions);
  const data = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
