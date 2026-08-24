import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SupplierDirectoryForm } from "./SupplierDirectoryForm";

export default async function SuppliersPage() {
  await requireRole("ADMIN");

  const suppliers = await prisma.supplierDirectory.findMany({
    orderBy: { code: "asc" },
  });

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
      <div className="mt-8">
        <SupplierDirectoryForm
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
    </div>
  );
}
