import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { getDictionary } from "@/i18n/getDictionary";
import { usesBento } from "@/lib/themes";
import { BentoGrid, Tile } from "@/components/bento/Bento";

export default async function AdminPage() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const dictionary = getDictionary(scope.user.language);
  const bento = usesBento(scope.user);

  const templates = await prisma.rfpTemplate.findMany({
    where: scope.where,
    orderBy: { createdAt: "desc" },
    include: { items: true, questions: true, client: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dictionary.adminDashboard.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {dictionary.adminDashboard.subtitle}
        </p>
      </div>

      {bento && (
        <BentoGrid className="mb-8">
          <Tile tone="dark" span={4}>
            <h2 className="text-lg font-medium tracking-tight">{dictionary.adminDashboard.masterDataTitle}</h2>
            <p className="mt-1 text-sm opacity-70">{dictionary.adminDashboard.masterDataSubtitle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["/admin/master-data/commodities", dictionary.adminDashboard.commodities],
                ["/admin/master-data/regions", dictionary.adminDashboard.regions],
                ["/admin/master-data/suppliers", dictionary.adminDashboard.suppliers],
                ["/admin/master-data/origins", dictionary.adminDashboard.origins],
                ["/admin/master-data/approval-groups", dictionary.adminDashboard.approvalGroups],
                ["/admin/master-data/items", dictionary.adminDashboard.itemCatalog],
                ["/admin/master-data/lookups", dictionary.lookups.title],
                ["/admin/master-data/view-groups", dictionary.viewGroups.title],
                ...(scope.isSuperAdmin
                  ? [
                      ["/admin/master-data/clients", dictionary.adminDashboard.clients],
                      ["/admin/custom-fields", dictionary.customFields.adminTitle],
                    ]
                  : []),
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm hover:bg-white/20"
                >
                  {label}
                </Link>
              ))}
            </div>
          </Tile>
          <Tile tone="lilac" span={2}>
            <h2 className="text-lg font-medium tracking-tight">{dictionary.adminDashboard.approvalsTitle}</h2>
            <p className="mt-1 text-sm opacity-70">{dictionary.adminDashboard.approvalsSubtitle}</p>
            <div className="mt-4">
              <Link href="/admin/approvals" className="rounded-full bg-black/10 px-3.5 py-1.5 text-sm hover:bg-black/20">
                {dictionary.adminDashboard.approvalsTitle}
              </Link>
            </div>
          </Tile>
          <Tile tone="lime" span={2}>
            <h2 className="text-lg font-medium tracking-tight">{dictionary.adminDashboard.usersTitle}</h2>
            <p className="mt-1 text-sm opacity-70">{dictionary.adminDashboard.usersSubtitle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/users" className="rounded-full bg-black/10 px-3.5 py-1.5 text-sm hover:bg-black/20">
                {dictionary.adminDashboard.usersLink}
              </Link>
              <Link href="/admin/buyer-groups" className="rounded-full bg-black/10 px-3.5 py-1.5 text-sm hover:bg-black/20">
                {dictionary.adminDashboard.buyerGroupsLink}
              </Link>
            </div>
          </Tile>
          <Tile tone="peach" span={2}>
            <h2 className="text-lg font-medium tracking-tight">{dictionary.adminDashboard.requestsTitle}</h2>
            <p className="mt-1 text-sm opacity-70">{dictionary.adminDashboard.requestsSubtitle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/request-templates" className="rounded-full bg-black/10 px-3.5 py-1.5 text-sm hover:bg-black/20">
                {dictionary.adminDashboard.requestTemplatesLink}
              </Link>
              <Link href="/admin/request-rfp-mapping" className="rounded-full bg-black/10 px-3.5 py-1.5 text-sm hover:bg-black/20">
                {dictionary.adminDashboard.requestRfpMappingLink}
              </Link>
            </div>
          </Tile>
          <Tile span={2}>
            <h2 className="text-lg font-medium tracking-tight">{dictionary.adminDashboard.emailsTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{dictionary.adminDashboard.emailsSubtitle}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/email-templates" className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm hover:bg-slate-200">
                {dictionary.adminDashboard.emailTemplatesLink}
              </Link>
              {scope.isSuperAdmin && (
                <Link href="/admin/email-log" className="rounded-full bg-violet-100 px-3.5 py-1.5 text-sm hover:bg-violet-200">
                  {dictionary.nav.emailLog}
                </Link>
              )}
            </div>
          </Tile>
          <Tile span={scope.isSuperAdmin ? 2 : 4}>
            <h2 className="text-lg font-medium tracking-tight">{dictionary.adminDashboard.assistantTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{dictionary.adminDashboard.assistantSubtitle}</p>
            <div className="mt-4">
              <Link href="/admin/assistant" className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm hover:bg-slate-200">
                {dictionary.adminDashboard.assistantLink}
              </Link>
            </div>
          </Tile>
          {scope.isSuperAdmin && (
            <Tile tone="dark" span={2}>
              <h2 className="text-lg font-medium tracking-tight">{dictionary.adminDashboard.securityTitle}</h2>
              <p className="mt-1 text-sm opacity-70">{dictionary.adminDashboard.securitySubtitle}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/admin/login-log" className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm hover:bg-white/20">
                  {dictionary.adminDashboard.loginLogLink}
                </Link>
                <Link href="/admin/system-tables/log" className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm hover:bg-white/20">
                  {dictionary.adminDashboard.changeLogLink}
                </Link>
              </div>
            </Tile>
          )}
        </BentoGrid>
      )}

      {!bento && (
        <>
      <CollapsibleSection
        title={dictionary.adminDashboard.masterDataTitle}
        subtitle={dictionary.adminDashboard.masterDataSubtitle}
        storageKey="admin-hub-master-data"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/master-data/commodities"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.commodities}
          </Link>
          <Link
            href="/admin/master-data/regions"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.regions}
          </Link>
          <Link
            href="/admin/master-data/suppliers"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.suppliers}
          </Link>
          <Link
            href="/admin/master-data/origins"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.origins}
          </Link>
          <Link
            href="/admin/master-data/approval-groups"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.approvalGroups}
          </Link>
          <Link
            href="/admin/master-data/items"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.itemCatalog}
          </Link>
          <Link
            href="/admin/master-data/lookups"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.lookups.title}
          </Link>
          <Link
            href="/admin/master-data/view-groups"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.viewGroups.title}
          </Link>
          {scope.isSuperAdmin && (
            <Link
              href="/admin/master-data/clients"
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              {dictionary.adminDashboard.clients}
            </Link>
          )}
          {scope.isSuperAdmin && (
            <Link
              href="/admin/custom-fields"
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              {dictionary.customFields.adminTitle}
            </Link>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={dictionary.adminDashboard.approvalsTitle}
        subtitle={dictionary.adminDashboard.approvalsSubtitle}
        storageKey="admin-hub-approvals"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/approvals"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.approvalsTitle}
          </Link>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={dictionary.adminDashboard.usersTitle}
        subtitle={dictionary.adminDashboard.usersSubtitle}
        storageKey="admin-hub-users"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.usersLink}
          </Link>
          <Link
            href="/admin/buyer-groups"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.buyerGroupsLink}
          </Link>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={dictionary.adminDashboard.requestsTitle}
        subtitle={dictionary.adminDashboard.requestsSubtitle}
        storageKey="admin-hub-requests"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/request-templates"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.requestTemplatesLink}
          </Link>
          <Link
            href="/admin/request-rfp-mapping"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.requestRfpMappingLink}
          </Link>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={dictionary.adminDashboard.emailsTitle}
        subtitle={dictionary.adminDashboard.emailsSubtitle}
        storageKey="admin-hub-emails"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/email-templates"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.emailTemplatesLink}
          </Link>
          {scope.isSuperAdmin && (
            <Link
              href="/admin/email-log"
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              {dictionary.nav.emailLog}
            </Link>
          )}
        </div>
      </CollapsibleSection>

      {scope.isSuperAdmin && (
        <CollapsibleSection
          title={dictionary.adminDashboard.securityTitle}
          subtitle={dictionary.adminDashboard.securitySubtitle}
          storageKey="admin-hub-security"
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/login-log"
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              {dictionary.adminDashboard.loginLogLink}
            </Link>
            <Link
              href="/admin/system-tables/log"
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              {dictionary.adminDashboard.changeLogLink}
            </Link>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={dictionary.adminDashboard.assistantTitle}
        subtitle={dictionary.adminDashboard.assistantSubtitle}
        storageKey="admin-hub-assistant"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/assistant"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.assistantLink}
          </Link>
        </div>
      </CollapsibleSection>

        </>
      )}

      <CollapsibleSection
        title={dictionary.adminDashboard.templatesTitle}
        subtitle={dictionary.adminDashboard.templatesSubtitle}
        storageKey="admin-hub-templates"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        right={
          <Link
            href="/admin/templates/new"
            className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
          >
            {dictionary.adminDashboard.newTemplate}
          </Link>
        }
      >
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {dictionary.adminDashboard.noTemplatesConfigured}
        </div>
      ) : (
        <div className="-mx-6 -mb-6 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{dictionary.adminDashboard.templateHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.clientHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.conditionHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.itemsHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.questionsHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.statusHeader}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="font-medium text-slate-900 hover:text-violet-600"
                    >
                      {t.name}
                    </Link>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {t.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.client.icon ? `${t.client.icon} ` : ""}
                    {t.client.description}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.matchCommodity || t.matchRegion ? (
                      <>
                        {t.matchCommodity && (
                          <span className="mr-2">
                            {dictionary.adminDashboard.commodityPrefix} {t.matchCommodity}
                          </span>
                        )}
                        {t.matchRegion && (
                          <span>{dictionary.adminDashboard.regionPrefix} {t.matchRegion}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">{dictionary.adminDashboard.anyRfp}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.items.length}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.questions.length}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.active ? dictionary.adminDashboard.active : dictionary.adminDashboard.inactive}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      {dictionary.adminDashboard.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      </CollapsibleSection>
    </div>
  );
}
