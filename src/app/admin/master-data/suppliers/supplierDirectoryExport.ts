import * as XLSX from "xlsx";
import {
  SUPPLIER_SHEET_NAME,
  statusToLabel,
  type SupplierDirectoryRow,
} from "./supplierDirectorySchema";
import type { SupplierDirectoryItemInput } from "./actions";

export function downloadSupplierDirectoryExcel(
  filename: string,
  rows: SupplierDirectoryItemInput[],
) {
  const data: SupplierDirectoryRow[] = rows.map((r) => ({
    CodigoProveedor: r.code,
    CIF: r.taxId,
    Empresa: r.companyName,
    Nombre: r.contactFirstName,
    Apellido: r.contactLastName,
    Correo: r.email,
    Telefono: r.phone,
    Estado: statusToLabel(r.status),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data),
    SUPPLIER_SHEET_NAME,
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
