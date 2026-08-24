import * as XLSX from "xlsx";
import { MASTER_DATA_SHEET_NAME, type MasterDataRow } from "@/lib/masterDataSchema";
import { makeClientKey } from "@/lib/clientKey";

export type ImportedMasterDataRow = {
  clientKey: string;
  code: string;
  description: string;
  parentCode: string | null;
};

export async function parseMasterDataExcelFile(
  file: File,
): Promise<ImportedMasterDataRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.includes(MASTER_DATA_SHEET_NAME)
    ? MASTER_DATA_SHEET_NAME
    : workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const rows: Partial<MasterDataRow>[] = sheet
    ? XLSX.utils.sheet_to_json(sheet)
    : [];

  return rows
    .map((row) => ({
      clientKey: makeClientKey(),
      code: (row.ID ?? "").toString().trim(),
      description: (row.Descripcion ?? "").toString().trim(),
      parentCode: (row.PadreID ?? "").toString().trim() || null,
    }))
    .filter((row) => row.code.length > 0 && row.description.length > 0);
}
