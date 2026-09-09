"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireClientScope } from "@/lib/clientScope";
import type { UserRole } from "@/generated/prisma/enums";

export type UserFormInput = {
  name: string;
  lastName: string;
  clientId: string | null;
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

// A CLIENT_ADMIN acts only within their own client and can never mint or
// edit a cross-client ADMIN; only ADMIN itself can do either. Returns the
// clientId to persist, or an error string.
function resolveTargetClientAndRole(
  scope: Awaited<ReturnType<typeof requireClientScope>>,
  input: UserFormInput,
): { clientId: string | null } | { error: string } {
  if (scope.isSuperAdmin) {
    if (input.role === "ADMIN") {
      if (input.clientId) {
        return { error: "Un Super Administrador no pertenece a un cliente." };
      }
      return { clientId: null };
    }
    if (!input.clientId) {
      return { error: "Selecciona el cliente de este usuario." };
    }
    return { clientId: input.clientId };
  }
  // CLIENT_ADMIN actor: fixed to their own client, can't grant ADMIN.
  if (input.role === "ADMIN") {
    return { error: "Solo un Super Administrador puede crear otro." };
  }
  if (!scope.user.clientId) {
    return { error: "Tu usuario no tiene un cliente asignado." };
  }
  return { clientId: scope.user.clientId };
}

export async function createUser(
  input: UserFormInput,
): Promise<{ error: string } | never> {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "El nombre es obligatorio." };
  if (!email) return { error: "El correo es obligatorio." };
  if (!input.password || input.password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const targetClient = resolveTargetClientAndRole(scope, input);
  if ("error" in targetClient) return targetClient;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: `Ya existe un usuario con el correo "${email}".` };
  }

  const approvalGroups = targetClient.clientId
    ? shapeApprovalGroups(input.approvalGroups).map((g) => ({
        ...g,
        clientId: targetClient.clientId as string,
      }))
    : [];
  await prisma.user.create({
    data: {
      name,
      lastName: input.lastName.trim() || null,
      clientId: targetClient.clientId,
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
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Usuario no encontrado." };
  if (!scope.isSuperAdmin && target.clientId !== scope.user.clientId) {
    return { error: "No podés editar un usuario de otro cliente." };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "El nombre es obligatorio." };
  if (!email) return { error: "El correo es obligatorio." };
  if (input.password && input.password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const targetClient = resolveTargetClientAndRole(scope, input);
  if ("error" in targetClient) return targetClient;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    return { error: `Ya existe un usuario con el correo "${email}".` };
  }

  const approvalGroups = targetClient.clientId
    ? shapeApprovalGroups(input.approvalGroups).map((g) => ({
        ...g,
        clientId: targetClient.clientId as string,
      }))
    : [];
  await prisma.userApprovalGroup.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      lastName: input.lastName.trim() || null,
      clientId: targetClient.clientId,
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
