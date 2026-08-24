export const SUPPLIER_SHEET_NAME = "Proveedores";

export type SupplierDirectoryRow = {
  CodigoProveedor: string;
  CIF: string;
  Empresa: string;
  Nombre: string;
  Apellido: string;
  Correo: string;
  Telefono: string;
  Estado: string;
};

export function statusToLabel(status: string) {
  return status === "INACTIVE" ? "Inactivo" : "Activo";
}

export function labelToStatus(label: string): "ACTIVE" | "INACTIVE" {
  return (label ?? "").trim().toLowerCase() === "inactivo"
    ? "INACTIVE"
    : "ACTIVE";
}
