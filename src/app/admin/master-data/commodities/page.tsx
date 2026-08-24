import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MasterDataForm } from "../MasterDataForm";

export default async function CommoditiesPage() {
  await requireRole("ADMIN");

  const commodities = await prisma.commodity.findMany({
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
        Datos maestros &middot; Commodities
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Estos valores alimentan el desplegable de Commodity al crear una RFP
        o una plantilla.
      </p>
      <div className="mt-8">
        <MasterDataForm
          kind="commodity"
          label="Commodities"
          initial={commodities.map((c) => ({
            clientKey: c.id,
            code: c.code,
            description: c.description,
            parentClientKey: c.parentId,
          }))}
        />
      </div>
    </div>
  );
}
