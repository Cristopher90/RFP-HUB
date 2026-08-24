export interface TreeItem {
  id: string;
  parentId: string | null;
}

export interface TreeOrderEntry<T extends TreeItem> {
  item: T;
  depth: number;
}

// Depth-first tree order (roots first, each followed by its own subtree),
// used both to render an indented <select> and to lay out the admin editor.
// Orphaned/cyclic items still show up (as depth-0 roots) so nothing silently
// disappears from the list.
export function buildTreeOrder<T extends TreeItem>(
  items: T[],
): TreeOrderEntry<T>[] {
  const byParent = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(item);
  }

  const result: TreeOrderEntry<T>[] = [];
  const visited = new Set<string>();

  function visit(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push({ item: child, depth });
      visit(child.id, depth + 1);
    }
  }
  visit(null, 0);

  for (const item of items) {
    if (!visited.has(item.id)) {
      visited.add(item.id);
      result.push({ item, depth: 0 });
    }
  }

  return result;
}

const NBSP = String.fromCharCode(0x00a0);
const INDENT_PREFIX = String.fromCharCode(0x2014) + " ";

export function indentLabel(label: string, depth: number): string {
  return depth > 0
    ? `${NBSP.repeat(depth * 3)}${INDENT_PREFIX}${label}`
    : label;
}

export interface MasterDataOption {
  value: string;
  label: string;
}

// Builds <select> options (value = description, kept flat since that's what
// Rfp.commodity/region store) ordered and indented to reflect the tree.
export function buildMasterDataOptions(
  rows: { id: string; parentId: string | null; description: string }[],
): MasterDataOption[] {
  return buildTreeOrder(rows).map(({ item, depth }) => ({
    value: item.description,
    label: indentLabel(item.description, depth),
  }));
}
