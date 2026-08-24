"use client";

export type TreeCascadeNode = {
  id: string;
  parentId: string | null;
  label: string;
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Renders one <select> per tree depth: pick a root, its children appear in
// a second dropdown, their children in a third, and so on — always
// unfolding from the highest level down. Selecting a node with no children
// stops the cascade there; selecting one with children just narrows the
// next dropdown's options without forcing you to go deeper.
export function TreeCascadeSelect({
  nodes,
  valueId,
  onChangeId,
  rootPlaceholder,
  excludeIds,
}: {
  nodes: TreeCascadeNode[];
  valueId: string | null;
  onChangeId: (id: string | null) => void;
  rootPlaceholder: string;
  excludeIds?: Set<string>;
}) {
  const visibleNodes = excludeIds
    ? nodes.filter((n) => !excludeIds.has(n.id))
    : nodes;
  const byId = new Map(visibleNodes.map((n) => [n.id, n]));

  // Walk parent links up to the root to know which option is pre-selected
  // at each level; a visited-set guards against a cyclic parentId chain.
  const chain: string[] = [];
  let current = valueId ? byId.get(valueId) : undefined;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  const levels: { options: TreeCascadeNode[]; selectedId: string }[] = [];
  let parentId: string | null = null;
  let depth = 0;
  for (;;) {
    const options = visibleNodes.filter((n) => n.parentId === parentId);
    if (options.length === 0) break;
    const selectedId = chain[depth] ?? "";
    levels.push({ options, selectedId });
    if (!selectedId) break;
    parentId = selectedId;
    depth++;
  }

  function handleLevelChange(levelIndex: number, newId: string) {
    if (!newId) {
      const parentChainId = chain[levelIndex - 1];
      onChangeId(parentChainId ?? null);
      return;
    }
    onChangeId(newId);
  }

  return (
    <div className="space-y-2">
      {levels.map((level, i) => (
        <select
          key={i}
          className={inputClass()}
          value={level.selectedId}
          onChange={(e) => handleLevelChange(i, e.target.value)}
        >
          <option value="">
            {i === 0 ? rootPlaceholder : "— (ninguno) —"}
          </option>
          {level.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
