import { getCurrentUser } from "@/lib/auth";
import { ROLE_LEVEL } from "@/lib/roleLabels";
import { getDictionary } from "@/i18n/getDictionary";
import { canViewRequests } from "@/lib/requestAccess";
import { assistantAccess } from "@/lib/assistant/access";
import { SidebarNav, type SidebarItem } from "@/components/SidebarNav";
import { unreadForBuyer } from "@/lib/rfpMessages";

export async function Sidebar() {
  const user = await getCurrentUser();

  if (!user) return null;
  const dictionary = getDictionary(user.language);

  // Unread supplier messages on the RFPs this user can answer: shown next to "RFPs".
  const unreadMessages = (await unreadForBuyer(user)).reduce((sum, r) => sum + r.unread, 0);
  const hasAssistant = Boolean(await assistantAccess(user));
  const items: SidebarItem[] = [
    { href: "/home", label: dictionary.nav.home, icon: "home" },
    { href: "/", label: dictionary.nav.rfps, icon: "rfps", badge: unreadMessages },
    ...(canViewRequests(user)
      ? [{ href: "/requests", label: dictionary.nav.requests, icon: "requests" as const }]
      : []),
    ...(user.role !== "APPROVER"
      ? [{ href: "/suppliers", label: dictionary.nav.suppliers, icon: "suppliers" as const }]
      : []),
    { href: "/reports", label: dictionary.nav.reports, icon: "reports" },
    ...(hasAssistant ? [{ href: "/assistant", label: dictionary.nav.assistant, icon: "assistant" as const }] : []),
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
    <aside data-app-sidebar className="hidden w-56 shrink-0 border-r border-slate-200 bg-white/60 sm:block">
      <SidebarNav items={items} />
    </aside>
  );
}
