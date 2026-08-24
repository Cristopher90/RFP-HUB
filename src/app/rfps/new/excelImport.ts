import * as XLSX from "xlsx";
import {
  ITEM_SHEET_NAME,
  QUESTION_SHEET_NAME,
  labelToBool,
  labelToRespondedBy,
  labelToType,
  labelToVisibility,
  type ItemRow,
  type QuestionRow,
} from "@/lib/excelSchema";
import { makeClientKey } from "@/lib/clientKey";
import type {
  NewItemInput,
  NewQuestionInput,
  QuestionType,
  QuestionVisibility,
} from "./actions";

export async function parseRfpExcelFile(file: File): Promise<{
  items: NewItemInput[];
  questions: NewQuestionInput[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const itemSheet = workbook.Sheets[ITEM_SHEET_NAME];
  const questionSheet = workbook.Sheets[QUESTION_SHEET_NAME];

  const itemRows: Partial<ItemRow>[] = itemSheet
    ? XLSX.utils.sheet_to_json(itemSheet)
    : [];
  const questionRows: Partial<QuestionRow>[] = questionSheet
    ? XLSX.utils.sheet_to_json(questionSheet)
    : [];

  const items: NewItemInput[] = itemRows
    .filter((row) => (row.Nombre ?? "").toString().trim().length > 0)
    .map((row) => ({
      section: (row.Seccion ?? "").toString().trim() || null,
      code: (row.Codigo ?? "").toString().trim() || null,
      name: (row.Nombre ?? "").toString().trim(),
      description: (row.Descripcion ?? "").toString().trim(),
      quantity: Number(row.Cantidad) || 1,
      unit: (row.Unidad ?? "unidad").toString().trim() || "unidad",
      weight: Math.min(10, Math.max(1, Number(row.Peso) || 1)),
      decimals: Math.min(4, Math.max(0, Number(row.Decimales) ?? 2)),
      historicalPrice: null,
      commodity: null,
      customFields: (row.CamposAdicionales ?? "")
        .toString()
        .split(";")
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
          const [label, ...rest] = pair.split(":");
          return { label: (label ?? "").trim(), value: rest.join(":").trim() };
        })
        .filter((f) => f.label.length > 0),
    }));

  const questionClientKeys = questionRows.map(() => makeClientKey());
  const questionTextToKey = new Map<string, string>();
  questionRows.forEach((row, index) => {
    const text = (row.Texto ?? "").toString().trim();
    if (text) questionTextToKey.set(text.toLowerCase(), questionClientKeys[index]);
  });

  const questions: NewQuestionInput[] = questionRows
    .filter((row) => (row.Texto ?? "").toString().trim().length > 0)
    .map((row) => {
      const type = labelToType((row.Tipo ?? "").toString()) as QuestionType;
      const condicionTipo = (row.CondicionTipo ?? "Ninguna")
        .toString()
        .trim()
        .toLowerCase();
      const respondedBy = labelToRespondedBy(
        (row.QuienResponde ?? "").toString(),
      );
      const isPrerequisite = labelToBool(
        (row.EsPrerrequisito ?? "").toString(),
      );
      const ownText = (row.Texto ?? "").toString().trim();
      const ownKey = questionTextToKey.get(ownText.toLowerCase()) ?? makeClientKey();

      let dependsOnQuestionKey: string | null = null;
      let dependsOnHeaderField: "commodity" | "region" | null = null;
      if (condicionTipo === "pregunta") {
        const refText = (row.CondicionPreguntaTexto ?? "")
          .toString()
          .trim()
          .toLowerCase();
        dependsOnQuestionKey = questionTextToKey.get(refText) ?? null;
      } else if (condicionTipo === "commodity") {
        dependsOnHeaderField = "commodity";
      } else if (condicionTipo === "region") {
        dependsOnHeaderField = "region";
      }

      return {
        clientKey: ownKey,
        section: (row.Seccion ?? "").toString().trim() || null,
        text: ownText,
        type,
        options:
          type === "SELECT"
            ? (row.Opciones ?? "")
                .toString()
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : [],
        required: labelToBool((row.Obligatoria ?? "").toString()),
        weight: Math.min(10, Math.max(1, Number(row.Peso) || 1)),
        isPrerequisite: respondedBy === "BUYER" ? false : isPrerequisite,
        visibility: (respondedBy === "BUYER"
          ? "INTERNAL"
          : labelToVisibility(
              (row.Visibilidad ?? "").toString(),
            )) as QuestionVisibility,
        respondedBy,
        numberMin:
          row.NumeroMin !== undefined && row.NumeroMin !== ""
            ? Number(row.NumeroMin)
            : null,
        numberMax:
          row.NumeroMax !== undefined && row.NumeroMax !== ""
            ? Number(row.NumeroMax)
            : null,
        dependsOnQuestionKey,
        dependsOnHeaderField,
        dependsOnValue: (row.CondicionValor ?? "").toString().trim(),
        buyerAnswerValue: (row.RespuestaComprador ?? "").toString().trim(),
      } satisfies NewQuestionInput;
    });

  return { items, questions };
}
