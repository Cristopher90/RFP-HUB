import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { ClientsForm } from "./ClientsForm";

export default async function ClientsPage() {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");

  const clients = await prisma.client.findMany({
    orderBy: { description: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Datos maestros &middot; Clientes
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Cada cliente aísla sus propios datos maestros, plantillas y RFPs.
        Solo el Super Administrador ve y edita esta lista.
      </p>
      <div className="mt-8">
        <ClientsForm
          initial={clients.map((c) => ({
            clientKey: c.id,
            code: c.code,
            description: c.description,
            icon: c.icon ?? "",
          }))}
        />
      </div>
    </div>
  );
}
