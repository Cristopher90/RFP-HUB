import type { UserRole } from "@/generated/prisma/enums";

// APPROVER sits outside the BUYER→ADMIN seniority ladder — it's a capability
// (can decide approvals, can't create RFPs), not a rank — so it's kept
// below BUYER rather than inserted into the hierarchy it doesn't belong to.
export const ROLE_LEVEL: Record<UserRole, number> = {
  APPROVER: 0,
  BUYER: 1,
  SENIOR_BUYER: 2,
  CLIENT_ADMIN: 3,
  ADMIN: 4,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  APPROVER: "Aprobador",
  BUYER: "Comprador",
  SENIOR_BUYER: "Comprador Senior",
  CLIENT_ADMIN: "Administrador de cliente",
  ADMIN: "Super Administrador",
};
