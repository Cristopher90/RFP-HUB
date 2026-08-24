import * as XLSX from "xlsx";
import { makeClientKey } from "@/lib/clientKey";
import {
  SUPPLIER_SHEET_NAME,
  labelToStatus,
  type SupplierDirectoryRow,
} from "./supplierDirectorySchema";
import type { SupplierDirectoryItemInput } from "./actions";

export async function parseSupplierDirectoryExcelFile(
  file: File,
): Promise<SupplierDirectoryItemInput[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.includes(SUPPLIER_SHEET_NAME)
    ? SUPPLIER_SHEET_NAME
    : workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const rows: Partial<SupplierDirectoryRow>[] = sheet
    ? XLSX.utils.sheet_to_json(sheet)
    : [];

  return rows
    .map((row) => ({
      clientKey: makeClientKey(),
      code: (row.CodigoProveedor ?? "").toString().trim(),
      taxId: (row.CIF ?? "").toString().trim(),
      companyName: (row.Empresa ?? "").toString().trim(),
      contactFirstName: (row.Nombre ?? "").toString().trim(),
      contactLastName: (row.Apellido ?? "").toString().trim(),
      email: (row.Correo ?? "").toString().trim(),
      phone: (row.Telefono ?? "").toString().trim(),
      status: labelToStatus((row.Estado ?? "").toString()),
    }))
    .filter((row) => row.code.length > 0 && row.companyName.length > 0);
}
