import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { EMAIL_KINDS, EMAIL_LANGUAGES } from "@/lib/emailKinds";
import { defaultTemplate } from "@/lib/emailTemplates";
import { EmailTemplatesForm, type TemplateCard } from "./EmailTemplatesForm";

export default async function EmailTemplatesPage({
  searchParams,
}: PageProps<"/admin/email-templates">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);

  const overrides = effectiveClientId
    ? await prisma.emailTemplate.findMany({ where: { clientId: effectiveClientId } })
    : [];

  const cards: TemplateCard[] = EMAIL_LANGUAGES.flatMap((language) =>
    EMAIL_KINDS.map((kind) => {
      const defaults = defaultTemplate(kind, language);
      const override = overrides.find((o) => o.kind === kind && o.language === language);
      return {
        kind,
        language,
        defaults,
        current: override
          ? {
              subject: override.subject,
              heading: override.heading,
              body: override.body,
              cta: override.cta,
            }
          : defaults,
        customized: Boolean(override),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {dictionary.emailTemplatesPage.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.emailTemplatesPage.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{dictionary.emailTemplatesPage.subtitle}</p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <EmailTemplatesForm
            key={effectiveClientId}
            targetClientId={effectiveClientId}
            cards={cards}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          {dictionary.emailTemplatesPage.selectClient}
        </p>
      )}
    </div>
  );
}
