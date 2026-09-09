import "server-only";
import { requireUser } from "@/lib/auth";

// The one place every list/detail query and every create action goes
// through for multi-tenant isolation. ADMIN is the only role without a
// clientId (it's what makes it a cross-client super user); every other
// role is always scoped to their own client, both for reads (`where`)
// and writes (`clientId` is stamped server-side, never trusted from the
// client payload).
export async function requireClientScope() {
  const user = await requireUser();
  const isSuperAdmin = user.role === "ADMIN";
  return {
    user,
    isSuperAdmin,
    // Every non-ADMIN role is guaranteed a clientId (enforced in
    // createUser/updateUser); the cast just reflects that invariant to
    // the type checker for Prisma `where` clauses, which don't accept
    // `null` for a required string field.
    where: isSuperAdmin ? {} : { clientId: user.clientId as string },
  };
}

// For create actions: the clientId to stamp on a new row. A super admin
// may pick any client (falls back to null/omitted if they haven't); every
// other role is always forced onto their own, ignoring anything the
// client payload might have sent.
export function resolveClientId(
  scope: Awaited<ReturnType<typeof requireClientScope>>,
  requestedClientId?: string | null,
): string {
  if (scope.isSuperAdmin) {
    if (!requestedClientId) {
      throw new Error("Selecciona un cliente.");
    }
    return requestedClientId;
  }
  if (!scope.user.clientId) {
    throw new Error("Tu usuario no tiene un cliente asignado.");
  }
  return scope.user.clientId;
}
