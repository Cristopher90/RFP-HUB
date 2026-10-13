// Grupos de visualización: qué ve un usuario según los grupos que comparte con
// cada proveedor, commodity, región o plantilla. Client-safe (sin DB).
//
// Reglas: el Super Administrador y el Administrador de cliente ven todo. Un
// usuario sin grupos ve todo lo de su cliente. Un usuario con grupos ve lo que
// no tiene grupos asignados más lo que comparte al menos un grupo.

export type ViewGroupUser = { role: string; viewGroupIds: string[] };

export function isViewGroupExempt(user: { role: string }): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN";
}

// True when the user has no restriction at all.
export function seesEverything(user: ViewGroupUser): boolean {
  return isViewGroupExempt(user) || user.viewGroupIds.length === 0;
}

export function canSeeByGroups(user: ViewGroupUser, entityGroupIds: string[] | null | undefined): boolean {
  if (seesEverything(user)) return true;
  const groups = entityGroupIds ?? [];
  if (groups.length === 0) return true;
  return groups.some((g) => user.viewGroupIds.includes(g));
}

// Prisma `where` fragment for an entity with a viewGroupIds column ({} = no restriction).
export function viewGroupWhere(user: ViewGroupUser): Record<string, unknown> {
  if (seesEverything(user)) return {};
  return {
    OR: [{ viewGroupIds: { isEmpty: true } }, { viewGroupIds: { hasSome: user.viewGroupIds } }],
  };
}

type TreeNode = { id: string; parentId: string | null; viewGroupIds?: string[] | null };

// Filters a tree (commodities / regions). A node without groups of its own
// inherits the nearest ancestor's; visible nodes whose parent is hidden move up
// to their nearest visible ancestor so the tree stays navigable.
export function filterTreeByGroups<T extends TreeNode>(nodes: T[], user: ViewGroupUser): T[] {
  if (seesEverything(user)) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const effective = (node: T): string[] => {
    const seen = new Set<string>();
    let current: T | undefined = node;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.viewGroupIds && current.viewGroupIds.length > 0) return current.viewGroupIds;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return [];
  };
  const visible = new Set(nodes.filter((n) => canSeeByGroups(user, effective(n))).map((n) => n.id));
  return nodes
    .filter((n) => visible.has(n.id))
    .map((n) => {
      let parentId = n.parentId;
      const seen = new Set<string>();
      while (parentId && !visible.has(parentId) && !seen.has(parentId)) {
        seen.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
      return parentId === n.parentId ? n : { ...n, parentId };
    });
}
