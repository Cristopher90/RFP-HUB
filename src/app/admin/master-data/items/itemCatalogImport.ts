import * as XLSX from "xlsx";
import { makeClientKey } from "@/lib/clientKey";
import { ITEM_CATALOG_SHEET_NAME } from "./itemCatalogExport";
import type { ItemCatalogItemInput } from "./actions";

type ItemCatalogRow = {
  Catalogo?: string;
  Codigo?: string;
  Articulo?: string;
  Descripcion?: string;
  Unidad?: string;
  Commodity?: string;
  UltimoPrecio?: string | number;
};

export async function parseItemCatalogExcelFile(
  file: File,
): Promise<ItemCatalogItemInput[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.includes(ITEM_CATALOG_SHEET_NAME)
    ? ITEM_CATALOG_SHEET_NAME
    : workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const rows: ItemCatalogRow[] = sheet ? XLSX.utils.sheet_to_json(sheet) : [];

  return rows
    .map((row) => ({
      clientKey: makeClientKey(),
      catalogName: (row.Catalogo ?? "").toString().trim(),
      code: (row.Codigo ?? "").toString().trim(),
      name: (row.Articulo ?? "").toString().trim(),
      description: (row.Descripcion ?? "").toString().trim(),
      unit: (row.Unidad ?? "").toString().trim(),
      commodity: (row.Commodity ?? "").toString().trim(),
      lastPrice: (row.UltimoPrecio ?? "").toString().trim(),
    }))
    .filter((row) => row.catalogName.length > 0 && row.code.length > 0 && row.name.length > 0);
}
