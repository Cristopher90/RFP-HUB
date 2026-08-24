import * as XLSX from "xlsx";
import { MASTER_DATA_SHEET_NAME, type MasterDataRow } from "@/lib/masterDataSchema";
import type { MasterDataItemInput } from "./actions";

export function downloadMasterDataExcel(
  filename: string,
  rows: MasterDataItemInput[],
) {
  const codeByKey = new Map(rows.map((r) => [r.clientKey, r.code]));
  const data: MasterDataRow[] = rows.map((r) => ({
    ID: r.code,
    Descripcion: r.description,
    PadreID: r.parentClientKey
      ? (codeByKey.get(r.parentClientKey) ?? "")
      : "",
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data),
    MASTER_DATA_SHEET_NAME,
  );
  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as ArrayBuffer;
  const blob = new Blob([buffer], {
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
