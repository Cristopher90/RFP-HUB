import { getDictionary } from "@/i18n/getDictionary";
import { statusLabel } from "@/i18n/labels";

const STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_PUBLISH_APPROVAL: "bg-amber-100 text-amber-700",
  AWAITING_START: "bg-blue-100 text-blue-700",
  OPEN: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-500",
  DELETED: "bg-red-100 text-red-600",
  INVITED: "bg-amber-100 text-amber-700",
  VIEWED: "bg-blue-100 text-blue-700",
  RESPONDED: "bg-emerald-100 text-emerald-700",
};

// Rendered from both Server Components (rfps/[id]/page.tsx, rounds/page.tsx)
// and Client Components (RfpTable.tsx, SupplierRfpTable.tsx) — a `language`
// prop (rather than the usePreferences() hook) keeps it safe to call from
// either, since hooks don't work when this renders as part of a server tree.
export function StatusBadge({ status, language }: { status: string; language: string }) {
  const dictionary = getDictionary(language);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {statusLabel(dictionary, status)}
    </span>
  );
}
