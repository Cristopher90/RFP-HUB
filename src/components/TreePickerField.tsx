"use client";

import { useEffect, useRef, useState } from "react";

export type TreePickerNode = {
  id: string;
  parentId: string | null;
  label: string;
};

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

// A single field that opens a popup to navigate a tree (commodity, región,
// origen, el "padre" de un dato maestro, ...): clicking a node with children
// drills into it inside the same popup instead of stacking a dropdown per
// depth. A breadcrumb shows where you are and jumps back to any ancestor.
// By default only leaves are selectable (picking "Hardware" only expands
// it); set allowSelectingBranches for fields where a non-leaf node is
// itself a valid value (a "padre" in datos maestros, or Origen).
export function TreePickerField({
  nodes,
  valueId,
  onChangeId,
  placeholder,
  clearLabel = "— Ninguno —",
  allowSelectingBranches = false,
}: {
  nodes: TreePickerNode[];
  valueId: string | null;
  onChangeId: (id: string | null) => void;
  placeholder: string;
  clearLabel?: string;
  allowSelectingBranches?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [browseParentId, setBrowseParentId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const hasChildren = (id: string) => nodes.some((n) => n.parentId === id);

  function openAtCurrentValue() {
    setBrowseParentId(
      ancestorsOf(nodes, valueId).slice(0, -1).pop()?.id ?? null,
    );
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Node labels in this app are already fully qualified (e.g. "Hardware /
  // IT"), so the closed field just shows the selected node's own label
  // rather than re-joining it with its ancestors' labels.
  const selectedNode = valueId ? (byId.get(valueId) ?? null) : null;

  const breadcrumb = ancestorsOf(nodes, browseParentId);
  const browseNode = browseParentId ? (byId.get(browseParentId) ?? null) : null;
  const levelOptions = nodes.filter((n) => n.parentId === browseParentId);

  function selectAndClose(id: string | null) {
    onChangeId(id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openAtCurrentValue())}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <span
          className={selectedNode ? "text-slate-800" : "text-slate-400"}
        >
          {selectedNode ? selectedNode.label : placeholder}
        </span>
        <span aria-hidden className="ml-2 text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[240px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-slate-100 px-1 pb-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setBrowseParentId(null)}
              className="hover:text-violet-600 hover:underline"
            >
              Todas
            </button>
            {breadcrumb.map((n) => (
              <span key={n.id} className="flex items-center gap-1">
                <span aria-hidden>›</span>
                <button
                  type="button"
                  onClick={() => setBrowseParentId(n.id)}
                  className="hover:text-violet-600 hover:underline"
                >
                  {n.label}
                </button>
              </span>
            ))}
          </div>

          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            <button
              type="button"
              onClick={() => selectAndClose(null)}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-50"
            >
              {clearLabel}
            </button>

            {browseNode && allowSelectingBranches && (
              <button
                type="button"
                onClick={() => selectAndClose(browseNode.id)}
                className={`block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-violet-50 ${
                  valueId === browseNode.id
                    ? "bg-violet-50 font-medium text-violet-700"
                    : "text-slate-600"
                }`}
              >
                Usar &quot;{browseNode.label}&quot;
              </button>
            )}

            {levelOptions.length === 0 && (
              <p className="px-2.5 py-1.5 text-sm text-slate-400">
                Sin subniveles.
              </p>
            )}

            {levelOptions.map((n) => {
              const children = hasChildren(n.id);
              const selected = valueId === n.id;
              return (
                <div
                  key={n.id}
                  className={`flex items-stretch rounded-md hover:bg-slate-50 ${
                    selected ? "bg-violet-50" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      children ? setBrowseParentId(n.id) : selectAndClose(n.id)
                    }
                    className={`flex-1 px-2.5 py-1.5 text-left text-sm ${
                      selected ? "font-medium text-violet-700" : "text-slate-700"
                    }`}
                  >
                    {n.label}
                  </button>
                  {children && allowSelectingBranches && (
                    <button
                      type="button"
                      onClick={() => selectAndClose(n.id)}
                      title={`Usar "${n.label}"`}
                      className="px-2 text-xs font-medium text-violet-500 hover:text-violet-700"
                    >
                      ✓
                    </button>
                  )}
                  {children && (
                    <span
                      aria-hidden
                      className="flex items-center px-2 text-slate-300"
                    >
                      ›
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
