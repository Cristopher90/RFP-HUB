"use client";

import { useEffect, useRef, useState } from "react";

export type TreePickerNode = {
  id: string;
  parentId: string | null;
  label: string;
  code?: string;
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

// A single field that opens a popup showing the whole tree (commodity,
// región, origen, el "padre" de un dato maestro, ...) as an expandable
// table with Nombre/ID columns — any node at any level can be selected
// directly by clicking its row; the disclosure triangle only expands or
// collapses its children.
export function TreePickerField({
  nodes,
  valueId,
  onChangeId,
  placeholder,
  clearLabel = "— Ninguno —",
}: {
  nodes: TreePickerNode[];
  valueId: string | null;
  onChangeId: (id: string | null) => void;
  placeholder: string;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const byId = new Map(nodes.map((n) => [n.id, n]));

  function openPopup() {
    setExpanded(new Set(ancestorsOf(nodes, valueId).map((n) => n.id)));
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

  const rows = flattenVisible(nodes, expanded);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPopup())}
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
        <div className="absolute z-30 mt-1 w-[420px] max-w-[90vw] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Selecciona un nivel
            </span>
            <button
              type="button"
              onClick={() => selectAndClose(null)}
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              {clearLabel}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-1.5">Nombre</th>
                  <th className="w-28 px-3 py-1.5">ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-3 text-slate-400">
                      Sin opciones.
                    </td>
                  </tr>
                )}
                {rows.map(({ node, depth, hasChildren }) => {
                  const selected = valueId === node.id;
                  return (
                    <tr
                      key={node.id}
                      onClick={() => selectAndClose(node.id)}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selected ? "bg-violet-50" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5">
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
                                expanded.has(node.id) ? "Contraer" : "Expandir"
                              }
                              className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 hover:text-violet-600"
                            >
                              {expanded.has(node.id) ? "▾" : "▸"}
                            </button>
                          ) : (
                            <span className="inline-block h-4 w-4 shrink-0" />
                          )}
                          <input
                            type="checkbox"
                            readOnly
                            checked={selected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => selectAndClose(node.id)}
                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span
                            className={
                              selected
                                ? "font-medium text-violet-700"
                                : "text-slate-700"
                            }
                          >
                            {node.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {node.code ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
