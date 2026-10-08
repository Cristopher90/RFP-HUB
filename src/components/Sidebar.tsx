import { getCurrentUser } from "@/lib/auth";
import { ROLE_LEVEL } from "@/lib/roleLabels";
import { getDictionary } from "@/i18n/getDictionary";
import { canViewRequests } from "@/lib/requestAccess";
import { SidebarNav, type SidebarItem } from "@/components/SidebarNav";

export async function Sidebar() {
  const user = await getCurrentUser();

  if (!user) return null;
  const dictionary = getDictionary(user.language);

  const items: SidebarItem[] = [
    { href: "/", label: dictionary.nav.rfps, icon: "rfps" },
    ...(canViewRequests(user)
      ? [{ href: "/requests", label: dictionary.nav.requests, icon: "requests" as const }]
      : []),
    { href: "/reports", label: dictionary.nav.reports, icon: "reports" },
    ...(ROLE_LEVEL[user.role] >= ROLE_LEVEL.CLIENT_ADMIN
      ? [{ href: "/admin", label: dictionary.nav.settings, icon: "settings" as const }]
      : []),
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/system-tables", label: dictionary.nav.systemTables, icon: "systemTables" as const },
          { href: "/admin/email-log", label: dictionary.nav.emailLog, icon: "emailLog" as const },
        ]
      : []),
  ];

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white/60 sm:block">
      <SidebarNav items={items} />
    </aside>
  );
}
