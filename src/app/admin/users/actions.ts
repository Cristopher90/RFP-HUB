"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";

export type UserFormInput = {
  name: string;
  lastName: string;
  client: string;
  email: string;
  companyCode: string;
  plant: string;
  costCenter: string;
  role: UserRole;
  password: string;
  allowFreeTextItems: boolean;
  approvalGroups: { approvalGroupId: string; limit: string }[];
};

// Cleans up the group-limit table: drops incomplete rows, dedupes by group
// (last one wins), parses the amount.
function shapeApprovalGroups(rows: { approvalGroupId: string; limit: string }[]) {
  const byGroupId = new Map<string, number>();
  for (const r of rows) {
    if (!r.approvalGroupId) continue;
    const n = Number(r.limit);
    if (!Number.isFinite(n)) continue;
    byGroupId.set(r.approvalGroupId, n);
  }
  return [...byGroupId.entries()].map(([approvalGroupId, limit]) => ({
    approvalGroupId,
    limit,
  }));
}

export async function createUser(
  input: UserFormInput,
): Promise<{ error: string } | never> {
  await requireRole("ADMIN");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "El nombre es obligatorio." };
  if (!email) return { error: "El correo es obligatorio." };
  if (!input.password || input.password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: `Ya existe un usuario con el correo "${email}".` };
  }

  const approvalGroups = shapeApprovalGroups(input.approvalGroups);
  await prisma.user.create({
    data: {
      name,
      lastName: input.lastName.trim() || null,
      client: input.client.trim() || null,
      email,
      companyCode: input.companyCode.trim() || null,
      plant: input.plant.trim() || null,
      costCenter: input.costCenter.trim() || null,
      role: input.role,
      allowFreeTextItems: input.allowFreeTextItems,
      passwordHash: hashPassword(input.password),
      approvalGroups: { create: approvalGroups },
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUser(
  userId: string,
  input: UserFormInput,
): Promise<{ error: string } | never> {
  await requireRole("ADMIN");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "El nombre es obligatorio." };
  if (!email) return { error: "El correo es obligatorio." };
  if (input.password && input.password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    return { error: `Ya existe un usuario con el correo "${email}".` };
  }

  const approvalGroups = shapeApprovalGroups(input.approvalGroups);
  await prisma.userApprovalGroup.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      lastName: input.lastName.trim() || null,
      client: input.client.trim() || null,
      email,
      companyCode: input.companyCode.trim() || null,
      plant: input.plant.trim() || null,
      costCenter: input.costCenter.trim() || null,
      role: input.role,
      allowFreeTextItems: input.allowFreeTextItems,
      approvalGroups: { create: approvalGroups },
      ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
