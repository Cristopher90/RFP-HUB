"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { findSystemTable } from "@/lib/systemTables";
import {
  analyzeDelete,
  auditSnapshot,
  castFor,
  fetchRow,
  getTableMeta,
  relationsOf,
  tableKeyOf,
  type DeleteAnalysis,
} from "@/lib/systemTablesMeta";

// Edit / delete rows of any table (Super Administrador only). Every change is
// written to SystemTableLog with the row before and after, and deleting is
// refused when other rows depend on the row in a way the database would block.

async function requireSuperAdmin() {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) throw new Error("Forbidden");
  return scope.user;
}

async function resolve(tableKey: string) {
  const table = findSystemTable(tableKey);
  if (!table) return null;
  return { table, meta: await getTableMeta(table.label) };
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Prisma wraps database errors in a long message; keep the useful tail.
  return message.split("\n").filter(Boolean).pop()?.slice(0, 300) ?? "Error";
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export type RelationsView = {
  children: { table: string; tableKey: string | null; column: string; rule: string; count: number }[];
  parents: { table: string; tableKey: string | null; column: string; viaColumn: string; value: string }[];
};

export async function loadRowRelations(
  tableKey: string,
  id: string,
): Promise<{ error: string } | ({ ok: true } & RelationsView)> {
  await requireSuperAdmin();
  const resolved = await resolve(tableKey);
  if (!resolved) return { error: "Unknown table" };
  const row = await fetchRow(resolved.meta, id);
  if (!row) return { error: "Row not found" };
  const { children, parents } = await relationsOf(resolved.meta, row);
  return {
    ok: true,
    children: children.map((c) => ({ ...c, tableKey: tableKeyOf(c.table) })),
    parents: parents.map((p) => ({ ...p, tableKey: tableKeyOf(p.table) })),
  };
}

export type DeletePreview = {
  cascades: { table: string; count: number }[];
  setNull: { target: string; count: number }[];
  blockers: { table: string; tableKey: string | null; column: string; count: number; sampleIds: string[] }[];
  protectedReason?: string;
};

function toPreview(a: DeleteAnalysis): DeletePreview {
  return {
    cascades: Object.entries(a.cascades).map(([table, count]) => ({ table, count })),
    setNull: Object.entries(a.setNull).map(([target, count]) => ({ target, count })),
    blockers: a.blockers.map((b) => ({ ...b, tableKey: tableKeyOf(b.table) })),
  };
}

export async function previewDelete(
  tableKey: string,
  id: string,
): Promise<{ error: string } | ({ ok: true } & DeletePreview)> {
  const user = await requireSuperAdmin();
  const resolved = await resolve(tableKey);
  if (!resolved) return { error: "Unknown table" };
  if (resolved.meta.immutable || !resolved.meta.pk) return { error: "This table is read-only." };
  const row = await fetchRow(resolved.meta, id);
  if (!row) return { error: "Row not found" };
  const preview = toPreview(await analyzeDelete(resolved.meta.table, [id]));
  if (resolved.meta.table === "User" && id === user.id) {
    preview.protectedReason = "own-user";
  }
  return { ok: true, ...preview };
}

export async function updateSystemRow(
  tableKey: string,
  id: string,
  values: Record<string, string | null>,
): Promise<{ error: string } | { success: true }> {
  const user = await requireSuperAdmin();
  const resolved = await resolve(tableKey);
  if (!resolved) return { error: "Unknown table" };
  const { meta } = resolved;
  if (meta.immutable || !meta.pk) return { error: "This table is read-only." };

  const entries = Object.entries(values);
  if (entries.length === 0) return { error: "No changes." };
  for (const [name, raw] of entries) {
    const col = meta.columns.find((c) => c.name === name);
    if (!col || !col.editable) return { error: `Column "${name}" can't be edited.` };
    if (raw === null && !col.nullable) return { error: `Column "${name}" can't be empty.` };
  }
  // Parameters are numbered by position; assigning NULL binds nothing.
  const rebuilt: string[] = [];
  const bound: string[] = [];
  for (const [name, raw] of entries) {
    const col = meta.columns.find((c) => c.name === name)!;
    const cast = castFor(col, raw, bound.length + 1);
    if (cast.param !== undefined) bound.push(cast.param);
    rebuilt.push(`"${name}" = ${cast.sql}`);
  }

  try {
    const before = await fetchRow(meta, id);
    if (!before) return { error: "Row not found" };
    const ip = await clientIp();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `UPDATE "${meta.table}" SET ${rebuilt.join(", ")} WHERE "${meta.pk}" = $${bound.length + 1} RETURNING *`,
        ...bound,
        id,
      );
      const after = updated[0];
      if (!after) throw new Error("Row not found");
      const beforeSnap = auditSnapshot(before);
      const afterSnap = auditSnapshot(after);
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [name] of entries) {
        if (JSON.stringify(beforeSnap[name]) !== JSON.stringify(afterSnap[name])) {
          changes[name] = { from: beforeSnap[name], to: afterSnap[name] };
        }
      }
      await tx.systemTableLog.create({
        data: {
          userId: user.id,
          userName: `${user.name} ${user.lastName ?? ""}`.trim(),
          userEmail: user.email,
          table: meta.table,
          rowId: id,
          action: "UPDATE",
          before: beforeSnap as object,
          after: afterSnap as object,
          changes: changes as object,
          ip,
        },
      });
    });
  } catch (error) {
    return { error: friendlyError(error) };
  }
  revalidatePath(`/admin/system-tables/${tableKey}`);
  return { success: true };
}

export async function deleteSystemRow(
  tableKey: string,
  id: string,
): Promise<{ error: string; preview?: DeletePreview } | { success: true }> {
  const user = await requireSuperAdmin();
  const resolved = await resolve(tableKey);
  if (!resolved) return { error: "Unknown table" };
  const { meta } = resolved;
  if (meta.immutable || !meta.pk) return { error: "This table is read-only." };
  if (meta.table === "User" && id === user.id) return { error: "own-user" };

  try {
    const before = await fetchRow(meta, id);
    if (!before) return { error: "Row not found" };
    const analysis = await analyzeDelete(meta.table, [id]);
    if (analysis.blockers.length > 0) return { error: "blocked", preview: toPreview(analysis) };
    const ip = await clientIp();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM "${meta.table}" WHERE "${meta.pk}" = $1`, id);
      await tx.systemTableLog.create({
        data: {
          userId: user.id,
          userName: `${user.name} ${user.lastName ?? ""}`.trim(),
          userEmail: user.email,
          table: meta.table,
          rowId: id,
          action: "DELETE",
          before: auditSnapshot(before) as object,
          impact: { cascades: analysis.cascades, setNull: analysis.setNull } as object,
          ip,
        },
      });
    });
  } catch (error) {
    return { error: friendlyError(error) };
  }
  revalidatePath(`/admin/system-tables/${tableKey}`);
  return { success: true };
}
