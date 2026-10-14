import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientScope } from "@/lib/clientScope";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { getDictionary } from "@/i18n/getDictionary";

export default async function AdminPage() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const dictionary = getDictionary(scope.user.language);

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
            href="/admin/master-data/document-types"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.supplierDocs.typesTitle}
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

      <CollapsibleSection
        title={dictionary.adminDashboard.templatesTitle}
        subtitle={dictionary.adminDashboard.templatesSubtitle}
        storageKey="admin-hub-templates"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/templates"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {dictionary.adminDashboard.templatesLink}
          </Link>
        </div>
      </CollapsibleSection>
    </div>
  );
}
