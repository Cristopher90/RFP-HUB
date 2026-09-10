import "server-only";
import { prisma } from "@/lib/prisma";

// Every Prisma model, exposed read-only to the Super Administrador as a
// raw table browser (/admin/system-tables) — for support/debugging, not
// a data-entry tool. `model` is the delegate key on `prisma` (camelCase
// model name); `key` is the URL-safe slug used in the route.
export const SYSTEM_TABLES = [
  { key: "client", label: "Client", model: "client" },
  { key: "user", label: "User", model: "user" },
  { key: "user-approval-group", label: "UserApprovalGroup", model: "userApprovalGroup" },
  { key: "commodity", label: "Commodity", model: "commodity" },
  { key: "region", label: "Region", model: "region" },
  { key: "origin", label: "Origin", model: "origin" },
  { key: "approval-group", label: "ApprovalGroup", model: "approvalGroup" },
  { key: "supplier-directory", label: "SupplierDirectory", model: "supplierDirectory" },
  { key: "item-catalog-list", label: "ItemCatalogList", model: "itemCatalogList" },
  { key: "item-catalog-entry", label: "ItemCatalogEntry", model: "itemCatalogEntry" },
  { key: "rfp-template", label: "RfpTemplate", model: "rfpTemplate" },
  { key: "approval-workflow", label: "ApprovalWorkflow", model: "approvalWorkflow" },
  { key: "approval-level", label: "ApprovalLevel", model: "approvalLevel" },
  { key: "template-item", label: "TemplateItem", model: "templateItem" },
  { key: "template-question", label: "TemplateQuestion", model: "templateQuestion" },
  { key: "rfp", label: "Rfp", model: "rfp" },
  { key: "rfp-approval", label: "RfpApproval", model: "rfpApproval" },
  { key: "rfp-approval-decision", label: "RfpApprovalDecision", model: "rfpApprovalDecision" },
  { key: "rfp-item", label: "RfpItem", model: "rfpItem" },
  { key: "rfp-question", label: "RfpQuestion", model: "rfpQuestion" },
  { key: "supplier", label: "Supplier", model: "supplier" },
  { key: "invitation", label: "Invitation", model: "invitation" },
  { key: "response", label: "Response", model: "response" },
  { key: "answer", label: "Answer", model: "answer" },
  { key: "item-price", label: "ItemPrice", model: "itemPrice" },
] as const;

export type SystemTableKey = (typeof SYSTEM_TABLES)[number]["key"];

export function findSystemTable(key: string) {
  return SYSTEM_TABLES.find((t) => t.key === key);
}

const MAX_ROWS = 300;

// Prisma's per-model delegates aren't a uniform type we can address
// generically without `any` — this is the one place that's allowed,
// since it's the whole point of a generic table browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDelegate = { findMany: (args: any) => Promise<Record<string, unknown>[]>; count: () => Promise<number> };

export async function loadSystemTableRows(table: (typeof SYSTEM_TABLES)[number]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[table.model] as AnyDelegate;
  const [rows, total] = await Promise.all([
    delegate.findMany({ take: MAX_ROWS }),
    delegate.count(),
  ]);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns, total, truncated: total > rows.length };
}

export function formatCellValue(
  value: unknown,
  yesNo: { yes: string; no: string },
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? yesNo.yes : yesNo.no;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
