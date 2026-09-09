import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { SupplierDirectoryForm } from "./SupplierDirectoryForm";

export default async function SuppliersPage({
  searchParams,
}: PageProps<"/admin/master-data/suppliers">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

  const suppliers = effectiveClientId
    ? await prisma.supplierDirectory.findMany({
        where: { clientId: effectiveClientId },
        include: { supplierUsers: { orderBy: { name: "asc" } } },
        orderBy: { code: "asc" },
      })
    : [];

  const supplierUsersByDirectoryId: Record<
    string,
    { clientKey: string; name: string; lastName: string; email: string; password: string }[]
  > = {};
  for (const s of suppliers) {
    supplierUsersByDirectoryId[s.id] = s.supplierUsers.map((u) => ({
      clientKey: u.id,
      name: u.name,
      lastName: u.lastName,
      email: u.email,
      password: "",
    }));
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Datos maestros &middot; Proveedores
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Directorio de proveedores de la organización.
      </p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <SupplierDirectoryForm
            key={effectiveClientId}
            targetClientId={effectiveClientId}
            isSuperAdmin={scope.isSuperAdmin}
            supplierUsersByDirectoryId={supplierUsersByDirectoryId}
            initial={suppliers.map((s) => ({
              clientKey: s.id,
              code: s.code,
              taxId: s.taxId,
              companyName: s.companyName,
              contactFirstName: s.contactFirstName,
              contactLastName: s.contactLastName,
              email: s.email,
              phone: s.phone,
              status: s.status,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          Selecciona un cliente para ver y editar sus proveedores.
        </p>
      )}
    </div>
  );
}
