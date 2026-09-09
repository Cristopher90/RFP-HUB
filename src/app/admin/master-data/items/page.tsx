import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ItemCatalogForm } from "./ItemCatalogForm";

export default async function ItemCatalogPage() {
  await requireRole("ADMIN");

  const [items, commodities] = await Promise.all([
    prisma.itemCatalogEntry.findMany({
      include: { catalogList: true },
      orderBy: [{ catalogList: { name: "asc" } }, { code: "asc" }],
    }),
    prisma.commodity.findMany({ orderBy: { description: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Datos maestros &middot; Catálogo de artículos
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Artículos disponibles para seleccionar al crear una RFP, con su
        último precio adjudicado como referencia histórica.
      </p>
      <div className="mt-8">
        <ItemCatalogForm
          commodities={commodities}
          initial={items.map((i) => ({
            clientKey: i.id,
            catalogName: i.catalogList.name,
            code: i.code,
            name: i.name,
            description: i.description ?? "",
            unit: i.unit,
            commodity: i.commodity ?? "",
            lastPrice: i.lastPrice !== null ? String(i.lastPrice) : "",
          }))}
        />
      </div>
    </div>
  );
}
