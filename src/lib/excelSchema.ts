// Shared column layout for RFP Excel import/export, so a file exported from
// one RFP can be re-imported (into the same or a new RFP) without the
// columns drifting apart between the two code paths.

export const ITEM_SHEET_NAME = "Articulos";
export const QUESTION_SHEET_NAME = "Preguntas";

export type ItemRow = {
  Seccion: string;
  Codigo: string;
  Nombre: string;
  Descripcion: string;
  Cantidad: number;
  Unidad: string;
  Peso: number;
  Decimales: number;
  CamposAdicionales: string;
};

export type QuestionRow = {
  Seccion: string;
  Texto: string;
  Tipo: string;
  Opciones: string;
  Obligatoria: string;
  Peso: number;
  EsPrerrequisito: string;
  QuienResponde: string;
  Visibilidad: string;
  NumeroMin: number | string;
  NumeroMax: number | string;
  CondicionTipo: string;
  CondicionValor: string;
  CondicionPreguntaTexto: string;
  RespuestaComprador: string;
};

const TYPE_TO_LABEL: Record<string, string> = {
  TEXT: "Texto",
  NUMBER: "Numero",
  SELECT: "OpcionMultiple",
  MONEY: "Dinero",
  ATTACHMENT: "Adjunto",
  YES_NO: "SiNo",
};

const LABEL_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_LABEL).map(([type, label]) => [
    label.toLowerCase(),
    type,
  ]),
);

export function typeToLabel(type: string) {
  return TYPE_TO_LABEL[type] ?? "Texto";
}

export function labelToType(label: string): string {
  return LABEL_TO_TYPE[(label ?? "").trim().toLowerCase()] ?? "TEXT";
}

const VISIBILITY_TO_LABEL: Record<string, string> = {
  EXTERNAL: "Externa",
  INTERNAL: "Interna",
  SUPPLIER_ONLY: "SoloProveedor",
};
const LABEL_TO_VISIBILITY: Record<string, string> = Object.fromEntries(
  Object.entries(VISIBILITY_TO_LABEL).map(([v, label]) => [
    label.toLowerCase(),
    v,
  ]),
);

export function visibilityToLabel(v: string) {
  return VISIBILITY_TO_LABEL[v] ?? "Externa";
}

export function labelToVisibility(label: string): string {
  return LABEL_TO_VISIBILITY[(label ?? "").trim().toLowerCase()] ?? "EXTERNAL";
}

export function respondedByToLabel(r: string) {
  return r === "BUYER" ? "Comprador" : "Proveedor";
}

export function labelToRespondedBy(label: string): "BUYER" | "SUPPLIER" {
  return (label ?? "").trim().toLowerCase() === "comprador"
    ? "BUYER"
    : "SUPPLIER";
}

export function boolToLabel(v: boolean) {
  return v ? "Si" : "No";
}

export function labelToBool(label: string) {
  return (label ?? "").trim().toLowerCase() === "si";
}
