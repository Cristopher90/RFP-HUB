import * as XLSX from "xlsx";
import type { HeaderMapping, ImportMode, LinesMapping } from "@/lib/requestFields";

// Reads purchase-request Excel files in the browser (the same way RFP Excel
// import does) and turns them into plain documents the server action stores.

export type WorkbookInfo = { sheets: { name: string; headers: string[] }[] };

function sheetHeaders(ws: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  return (rows[0] ?? []).map((v) => String(v).trim()).filter(Boolean);
}

// Sheet names and their header row, to let an admin pick sheets/columns when
// building an import template from a sample file.
export async function readWorkbookInfo(file: File): Promise<WorkbookInfo> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return {
    sheets: workbook.SheetNames.map((name) => ({
      name,
      headers: sheetHeaders(workbook.Sheets[name]),
    })),
  };
}

export type ParsedLine = {
  position: string;
  itemCode: string | null;
  description: string;
  historicalPrice: number | null;
  quantity: number;
  unit: string | null;
  commodity: string | null;
};

export type ParsedDocument = {
  documentType: string;
  documentNumber: string;
  creator: string | null;
  requestDate: string | null; // YYYY-MM-DD
  commodity: string | null;
  lines: ParsedLine[];
};

export type ImportIssue = {
  code:
    | "missingSheet"
    | "missingColumn"
    | "noDocuments"
    | "orphanLines"
    | "documentWithoutLines"
    | "invalidQuantity";
  value?: string;
};

function text(value: unknown): string {
  if (value instanceof Date || value === null || value === undefined) return "";
  return String(value).trim();
}

function optionalText(value: unknown): string | null {
  return text(value) || null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  let s = text(value).replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  return Number(s);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Excel dates are wall-clock (no timezone). SheetJS builds Date cells in the
// browser's local time, so local getters give back the date as typed.
export function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return validIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") {
    const parts = XLSX.SSF.parse_date_code(value);
    return parts ? validIso(parts.y, parts.m, parts.d) : null;
  }
  const s = text(value);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return validIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return validIso(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

export type ParseTemplate = {
  importMode: ImportMode;
  headerSheet: string;
  linesSheet: string;
  headerMapping: HeaderMapping;
  linesMapping: LinesMapping;
};

export async function parseRequestsFile(
  file: File,
  template: ParseTemplate,
): Promise<{ documents: ParsedDocument[]; issues: ImportIssue[] }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const issues: ImportIssue[] = [];

  const headerWs = workbook.Sheets[template.headerSheet];
  const linesWs = workbook.Sheets[template.linesSheet];
  if (!headerWs) issues.push({ code: "missingSheet", value: template.headerSheet });
  if (!linesWs) issues.push({ code: "missingSheet", value: template.linesSheet });
  if (!headerWs || !linesWs) return { documents: [], issues };

  const headerCols = new Set(sheetHeaders(headerWs));
  const lineCols = new Set(sheetHeaders(linesWs));
  const { headerMapping: hm, linesMapping: lm } = template;
  for (const [field, column] of Object.entries(hm)) {
    if (field === "documentTypeFixed" || !column) continue;
    if (!headerCols.has(column)) {
      issues.push({ code: "missingColumn", value: `${template.headerSheet}: ${column}` });
    }
  }
  for (const column of Object.values(lm)) {
    if (column && !lineCols.has(column)) {
      issues.push({ code: "missingColumn", value: `${template.linesSheet}: ${column}` });
    }
  }
  if (issues.some((i) => i.code === "missingColumn")) return { documents: [], issues };

  const cell = (row: Record<string, unknown>, column?: string) => (column ? row[column] : "");

  const headerRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(headerWs, {
    defval: "",
    raw: true,
  });
  const documents = new Map<string, ParsedDocument>();
  const byNumber = new Map<string, ParsedDocument>();
  for (const row of headerRows) {
    const documentNumber = text(cell(row, hm.documentNumber));
    if (!documentNumber) continue;
    const documentType =
      (hm.documentType ? text(cell(row, hm.documentType)) : (hm.documentTypeFixed ?? "").trim()) ||
      "PR";
    const key = `${documentType}\u0000${documentNumber}`;
    if (documents.has(key)) continue;
    const doc: ParsedDocument = {
      documentType,
      documentNumber,
      creator: optionalText(cell(row, hm.creator)),
      requestDate: toIsoDate(cell(row, hm.requestDate)),
      commodity: optionalText(cell(row, hm.commodity)),
      lines: [],
    };
    documents.set(key, doc);
    if (!byNumber.has(documentNumber)) byNumber.set(documentNumber, doc);
  }
  if (documents.size === 0) {
    issues.push({ code: "noDocuments" });
    return { documents: [], issues };
  }

  const lineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(linesWs, {
    defval: "",
    raw: true,
  });
  // One file per request: the first header row is the request and every line
  // belongs to it (no document number needed on the lines).
  const single = template.importMode === "SINGLE" ? [...documents.values()][0] : null;
  if (single) {
    documents.clear();
    documents.set("single", single);
  }
  let orphanLines = 0;
  lineRows.forEach((row) => {
    const description = text(cell(row, lm.description));
    if (!description) return;
    let doc: ParsedDocument | undefined;
    let documentNumber = single?.documentNumber ?? "";
    if (single) {
      doc = single;
    } else {
      documentNumber = text(cell(row, lm.documentNumber));
      if (!documentNumber) return;
      const lineType = lm.documentType ? text(cell(row, lm.documentType)) : "";
      doc = lineType
        ? documents.get(`${lineType}\u0000${documentNumber}`)
        : byNumber.get(documentNumber);
    }
    if (!doc) {
      orphanLines++;
      return;
    }
    const quantity = toNumber(cell(row, lm.quantity));
    if (!Number.isFinite(quantity)) {
      issues.push({ code: "invalidQuantity", value: `${documentNumber} / ${description}` });
      return;
    }
    const price = lm.historicalPrice ? toNumber(cell(row, lm.historicalPrice)) : NaN;
    doc.lines.push({
      position: text(cell(row, lm.position)) || String(doc.lines.length + 1),
      itemCode: optionalText(cell(row, lm.itemCode)),
      description,
      historicalPrice: Number.isFinite(price) ? price : null,
      quantity,
      unit: optionalText(cell(row, lm.unit)),
      commodity: optionalText(cell(row, lm.commodity)),
    });
  });
  if (orphanLines > 0) issues.push({ code: "orphanLines", value: String(orphanLines) });

  const result: ParsedDocument[] = [];
  for (const doc of documents.values()) {
    if (doc.lines.length === 0) {
      issues.push({ code: "documentWithoutLines", value: doc.documentNumber });
    } else {
      result.push(doc);
    }
  }
  return { documents: result, issues };
}
