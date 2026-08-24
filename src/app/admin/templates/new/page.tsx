import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplateForm } from "../TemplateForm";

export default async function NewTemplatePage() {
  await requireRole("ADMIN");

  const [commodities, regions] = await Promise.all([
    prisma.commodity.findMany({ orderBy: { description: "asc" } }),
    prisma.region.findMany({ orderBy: { description: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Nueva plantilla base
      </h1>
      <div className="mt-8">
        <TemplateForm
          commodities={commodities}
          regions={regions}
        />
      </div>
    </div>
  );
}
