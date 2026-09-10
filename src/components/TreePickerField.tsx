"use client";

import { useEffect, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type TreePickerNode = {
  id: string;
  parentId: string | null;
  label: string;
  code?: string;
  // false = this level is only for grouping its children, not a value you
  // can pick directly (e.g. a commodity category whose only real, choosable
  // values are its leaves). Omitted/true = choosable, the default for every
  // tree that doesn't have this concept at all.
  selectable?: boolean;
};

function displayLabel(n: TreePickerNode): string {
  return n.code ? `${n.code} — ${n.label}` : n.label;
}

function ancestorsOf(
  nodes: TreePickerNode[],
  id: string | null,
): TreePickerNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: TreePickerNode[] = [];
  let current = id ? byId.get(id) : undefined;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

type Row = { node: TreePickerNode; depth: number; hasChildren: boolean };

function flattenVisible(
  nodes: TreePickerNode[],
  expanded: Set<string>,
): Row[] {
  const byParent = new Map<string | null, TreePickerNode[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  const rows: Row[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const n of byParent.get(parentId) ?? []) {
      const hasChildren = (byParent.get(n.id)?.length ?? 0) > 0;
      rows.push({ node: n, depth, hasChildren });
      if (hasChildren && expanded.has(n.id)) walk(n.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}

// A single field that opens a centered modal popup (not an anchored
// dropdown, which gets clipped or misaligned inside scrollable tables and
// narrow columns) to browse the whole tree (commodity, región, origen, el
// "padre" de un dato maestro, ...) as an expandable table with Nombre/ID
// columns — any node at any level can be selected directly by clicking
// its row; the disclosure triangle only expands or collapses its
// children; typing in the search box flattens and filters by code/name.
export function TreePickerField({
  nodes,
  valueId,
  onChangeId,
  placeholder,
  clearLabel,
}: {
  nodes: TreePickerNode[];
  valueId: string | null;
  onChangeId: (id: string | null) => void;
  placeholder: string;
  clearLabel?: string;
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const byId = new Map(nodes.map((n) => [n.id, n]));

  function openPopup() {
    setExpanded(new Set(ancestorsOf(nodes, valueId).map((n) => n.id)));
    setQuery("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const selectedNode = valueId ? (byId.get(valueId) ?? null) : null;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAndClose(id: string | null) {
    onChangeId(id);
    setOpen(false);
  }

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const rows: Row[] = searching
    ? nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(trimmedQuery) ||
            n.code?.toLowerCase().includes(trimmedQuery),
        )
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((node) => ({ node, depth: 0, hasChildren: false }))
    : flattenVisible(nodes, expanded);

  return (
    <div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPopup}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <span className={selectedNode ? "text-slate-800" : "text-slate-400"}>
          {selectedNode ? displayLabel(selectedNode) : placeholder}
        </span>
        <span aria-hidden className="ml-2 text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("treePickerField.searchPlaceholder")}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={() => selectAndClose(null)}
                className="shrink-0 text-sm font-medium whitespace-nowrap text-violet-600 hover:text-violet-700"
              >
                {clearLabel ?? t("treePickerField.noneOption")}
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">{t("treePickerField.nameHeader")}</th>
                    <th className="w-28 px-4 py-2">{t("treePickerField.idHeader")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-slate-400">
                        {searching ? t("treePickerField.noResults") : t("treePickerField.noOptions")}
                      </td>
                    </tr>
                  )}
                  {rows.map(({ node, depth, hasChildren }) => {
                    const selected = valueId === node.id;
                    const selectable = node.selectable !== false;
                    // A non-selectable node (a pure grouping level, e.g. a
                    // commodity category) can still be browsed/expanded —
                    // clicking it just toggles its children instead of
                    // picking it as the value.
                    function handleRowClick() {
                      if (selectable) selectAndClose(node.id);
                      else if (hasChildren) toggleExpanded(node.id);
                    }
                    return (
                      <tr
                        key={node.id}
                        onClick={handleRowClick}
                        className={`hover:bg-violet-50 ${
                          selectable ? "cursor-pointer" : ""
                        } ${selected ? "bg-violet-50" : ""}`}
                      >
                        <td className="px-4 py-2">
                          <div
                            className="flex items-center gap-1.5"
                            style={{ paddingLeft: depth * 18 }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(node.id);
                                }}
                                aria-label={
                                  expanded.has(node.id)
                                    ? t("treePickerField.collapse")
                                    : t("treePickerField.expand")
                                }
                                className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 hover:text-violet-600"
                              >
                                {expanded.has(node.id) ? "▾" : "▸"}
                              </button>
                            ) : (
                              <span className="inline-block h-4 w-4 shrink-0" />
                            )}
                            {selectable ? (
                              <input
                                type="checkbox"
                                readOnly
                                checked={selected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => selectAndClose(node.id)}
                                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                              />
                            ) : (
                              <span className="inline-block h-3.5 w-3.5 shrink-0" />
                            )}
                            <span
                              className={
                                selected
                                  ? "font-medium text-violet-700"
                                  : selectable
                                    ? "text-slate-700"
                                    : "text-slate-400 italic"
                              }
                            >
                              {node.label}
                              {!selectable && t("treePickerField.categorySuffix")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {node.code ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t("treePickerField.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
