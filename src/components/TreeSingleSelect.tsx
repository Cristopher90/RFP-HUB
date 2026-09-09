"use client";

import { useState } from "react";

export type TreeNode = {
  id: string;
  parentId: string | null;
  label: string;
};

function ancestorsOf(nodes: TreeNode[], id: string | null): TreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: TreeNode[] = [];
  let current = id ? byId.get(id) : undefined;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

// A single <select> for navigating a tree (commodity, región, ...): picking
// a node with children drills into it in place — the same dropdown swaps
// to show its children — instead of stacking a new <select> per depth like
// TreeCascadeSelect does. A breadcrumb above shows where you are and lets
// you jump back to any ancestor level directly.
export function TreeSingleSelect({
  nodes,
  valueId,
  onChangeId,
  rootPlaceholder,
}: {
  nodes: TreeNode[];
  valueId: string | null;
  onChangeId: (id: string | null) => void;
  rootPlaceholder: string;
}) {
  const initialBrowseParentId =
    ancestorsOf(nodes, valueId).slice(0, -1).pop()?.id ?? null;
  const [browseParentId, setBrowseParentId] = useState<string | null>(
    initialBrowseParentId,
  );

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const browseNode = browseParentId ? byId.get(browseParentId) : null;
  const breadcrumb = ancestorsOf(nodes, browseParentId);
  const hasChildren = (id: string) => nodes.some((n) => n.parentId === id);
  const levelOptions = nodes.filter((n) => n.parentId === browseParentId);

  return (
    <div className="space-y-1">
      {breadcrumb.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
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
      )}
      <select
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        value={valueId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            onChangeId(null);
            return;
          }
          if (hasChildren(id)) {
            // Nodes with children are pure navigation: drill into them
            // without committing them as the selected value, so picking a
            // leaf several levels down never requires the field to first
            // hold an intermediate, incomplete value.
            setBrowseParentId(id);
          } else {
            onChangeId(id);
          }
        }}
      >
        <option value="">
          {browseNode ? `${browseNode.label} — sin seleccionar` : rootPlaceholder}
        </option>
        {levelOptions.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label}
            {hasChildren(n.id) ? " ›" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
