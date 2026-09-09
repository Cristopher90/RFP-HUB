import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";

// Shared by every admin screen that manages one client's data at a time
// (datos maestros, plantillas, procesos de aprobación): gates on
// CLIENT_ADMIN/ADMIN, and resolves which client's data this request
// operates on — the actor's own client, or (for a Super Administrador) a
// ?clientId= picked via AdminClientSwitcher. `effectiveClientId` is
// undefined until a Super Administrador has picked one, so callers must
// treat that as "show the picker, not the data".
export async function requireMasterDataScope(searchParams: {
  clientId?: string | string[];
}) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  if (scope.isSuperAdmin) {
    const clients = await prisma.client.findMany({
      orderBy: { description: "asc" },
    });
    const clientId =
      typeof searchParams.clientId === "string"
        ? searchParams.clientId
        : undefined;
    return { scope, clients, effectiveClientId: clientId };
  }

  return {
    scope,
    clients: [] as { id: string; code: string; description: string }[],
    effectiveClientId: scope.user.clientId ?? undefined,
  };
}
