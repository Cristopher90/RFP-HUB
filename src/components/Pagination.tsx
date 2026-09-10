"use client";

import { useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

// Shared by every "datos maestros" list (clients, commodities/regions/
// origins/approval groups, suppliers, item catalog): those lists can grow
// into the hundreds of rows, so they're paginated client-side over the
// already-filtered row array. Clamps the current page down automatically
// if a filter or page-size change shrinks the result set below it.
export function usePagination(totalItems: number) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  // Derived directly from render-time state rather than synced back via an
  // effect — a filter or page-size change can shrink pageCount below the
  // stored page, and the clamp always needs to be current, not one render
  // behind.
  const clampedPage = Math.min(Math.max(page, 1), pageCount);

  function setPageSizeAndReset(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return {
    page: clampedPage,
    pageSize,
    pageCount,
    setPage,
    setPageSize: setPageSizeAndReset,
  };
}

export function PaginationBar({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const { t } = usePreferences();
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <span>
        {t("pagination.showing")} {start}–{end} {t("pagination.of")} {totalItems}
      </span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5">
          {t("pagination.show")}
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            {t("pagination.previous")}
          </button>
          <span className="px-1">
            {t("pagination.page")} {page} {t("pagination.pageOf")} {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            {t("pagination.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
