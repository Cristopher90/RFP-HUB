import * as XLSX from "xlsx";
import type { ItemCatalogItemInput } from "./actions";

const ITEM_CATALOG_SHEET_NAME = "Catalogo";

type ItemCatalogRow = {
  Catalogo: string;
  Codigo: string;
  Articulo: string;
  Descripcion: string;
  Unidad: string;
  Commodity: string;
  UltimoPrecio: string;
};

export function downloadItemCatalogExcel(
  filename: string,
  rows: ItemCatalogItemInput[],
) {
  const data: ItemCatalogRow[] = rows.map((r) => ({
    Catalogo: r.catalogName,
    Codigo: r.code,
    Articulo: r.name,
    Descripcion: r.description,
    Unidad: r.unit,
    Commodity: r.commodity,
    UltimoPrecio: r.lastPrice,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(data),
    ITEM_CATALOG_SHEET_NAME,
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

export { ITEM_CATALOG_SHEET_NAME };
