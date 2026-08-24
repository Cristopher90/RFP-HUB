// Shared column layout for the Commodities/Regions master-data Excel import,
// so both a hand-made file and one exported later use the same columns.
export const MASTER_DATA_SHEET_NAME = "Datos";

export type MasterDataRow = {
  ID: string;
  Descripcion: string;
  PadreID: string;
};

export type MasterDataKind = "commodity" | "region" | "origin" | "approvalGroup";

export const MASTER_DATA_LABEL: Record<MasterDataKind, string> = {
  commodity: "Commodities",
  region: "Regiones",
  origin: "Orígenes",
  approvalGroup: "Grupos de aprobación",
};
