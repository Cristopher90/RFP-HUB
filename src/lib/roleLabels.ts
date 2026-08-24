import type { UserRole } from "@/generated/prisma/enums";

export const ROLE_LEVEL: Record<UserRole, number> = {
  BUYER: 1,
  SENIOR_BUYER: 2,
  ADMIN: 3,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  BUYER: "Comprador",
  SENIOR_BUYER: "Comprador Senior",
  ADMIN: "Administrador",
};
