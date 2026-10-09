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
  { key: "email-template", label: "EmailTemplate", model: "emailTemplate" },
  { key: "email-log", label: "EmailLog", model: "emailLog" },
  { key: "buyer-group", label: "BuyerGroup", model: "buyerGroup" },
  { key: "buyer-group-member", label: "BuyerGroupMember", model: "buyerGroupMember" },
  { key: "request-import-template", label: "RequestImportTemplate", model: "requestImportTemplate" },
  { key: "purchase-request", label: "PurchaseRequest", model: "purchaseRequest" },
  { key: "purchase-request-line", label: "PurchaseRequestLine", model: "purchaseRequestLine" },
  { key: "user-preference", label: "UserPreference", model: "userPreference" },
  { key: "login-event", label: "LoginEvent", model: "loginEvent" },
  { key: "supplier-user", label: "SupplierUser", model: "supplierUser" },
  { key: "supplier-user-link", label: "SupplierUserLink", model: "supplierUserLink" },
  { key: "request-rfp-mapping", label: "RequestRfpMapping", model: "requestRfpMapping" },
  { key: "system-table-log", label: "SystemTableLog", model: "systemTableLog" },
  { key: "note", label: "Note", model: "note" },
  { key: "note-target", label: "NoteTarget", model: "noteTarget" },
] as const;

// Audit-style tables: viewable here but never editable or deletable, so the
// trail of what happened can't be rewritten from this screen.
export const IMMUTABLE_TABLES: readonly string[] = ["EmailLog", "LoginEvent", "SystemTableLog"];

// Columns that are shown but never editable (credential hashes).
export const READONLY_COLUMNS: readonly string[] = ["passwordHash"];

// Logical grouping for the table list; a table missing here lands in "other".
export const SYSTEM_TABLE_GROUPS: { key: string; tables: string[] }[] = [
  { key: "tenancy", tables: ["Client", "User", "UserApprovalGroup", "UserPreference", "BuyerGroup", "BuyerGroupMember", "Note", "NoteTarget"] },
  { key: "masterData", tables: ["Commodity", "Region", "Origin", "ApprovalGroup", "SupplierDirectory", "ItemCatalogList", "ItemCatalogEntry"] },
  { key: "suppliers", tables: ["Supplier", "SupplierUser", "SupplierUserLink"] },
  { key: "templates", tables: ["RfpTemplate", "TemplateItem", "TemplateQuestion", "ApprovalWorkflow", "ApprovalLevel"] },
  { key: "rfps", tables: ["Rfp", "RfpItem", "RfpQuestion", "RfpApproval", "RfpApprovalDecision", "Invitation", "Response", "Answer", "ItemPrice"] },
  { key: "requests", tables: ["RequestImportTemplate", "RequestRfpMapping", "PurchaseRequest", "PurchaseRequestLine"] },
  { key: "audit", tables: ["EmailTemplate", "EmailLog", "LoginEvent", "SystemTableLog"] },
];

export function groupOfTable(label: string): string {
  return SYSTEM_TABLE_GROUPS.find((g) => g.tables.includes(label))?.key ?? "other";
}

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
