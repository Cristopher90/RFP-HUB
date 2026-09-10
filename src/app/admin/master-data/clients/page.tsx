import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { ClientsForm } from "./ClientsForm";
import { getDictionary } from "@/i18n/getDictionary";
import { CURRENCIES } from "@/lib/profileOptions";

export default async function ClientsPage() {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const dictionary = getDictionary(scope.user.language);

  const clients = await prisma.client.findMany({
    orderBy: { description: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.masterDataScreen.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.masterDataScreen.titlePrefix} &middot; {dictionary.clientsPage.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.clientsPage.subtitle}
      </p>
      <div className="mt-8">
        <ClientsForm
          initial={clients.map((c) => ({
            clientKey: c.id,
            code: c.code,
            description: c.description,
            icon: c.icon ?? "",
            currency: c.currency,
          }))}
          currencies={CURRENCIES}
        />
      </div>
    </div>
  );
}
