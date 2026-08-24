import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MasterDataForm } from "../MasterDataForm";

export default async function OriginsPage() {
  await requireRole("ADMIN");

  const origins = await prisma.origin.findMany({
    orderBy: { code: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Datos maestros &middot; Orígenes
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Estos valores alimentan el desplegable de Origen en la cabecera de la
        RFP (campo opcional, no visible para el proveedor).
      </p>
      <div className="mt-8">
        <MasterDataForm
          kind="origin"
          label="Orígenes"
          initial={origins.map((o) => ({
            clientKey: o.id,
            code: o.code,
            description: o.description,
            parentClientKey: o.parentId,
          }))}
        />
      </div>
    </div>
  );
}
