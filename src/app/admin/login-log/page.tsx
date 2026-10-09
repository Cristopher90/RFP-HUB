import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime } from "@/lib/format";
import { zonedTimeToUtc } from "@/lib/timezone";
import { LoginLogFilters } from "./LoginLogFilters";

const LIMIT = 300;
const EVENT_STYLE: Record<string, string> = {
  LOGIN: "bg-emerald-100 text-emerald-700",
  LOGOUT: "bg-slate-100 text-slate-600",
  LOGIN_FAILED: "bg-red-100 text-red-700",
};

// "Chrome · macOS" from a raw User-Agent string (good enough for an audit log).
function describeAgent(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "—";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

// Super Administrador only: who signed in or out, when, and from where.
export default async function LoginLogPage({ searchParams }: PageProps<"/admin/login-log">) {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const { user } = scope;
  const dictionary = getDictionary(user.language);
  const d = dictionary.loginLogPage;
  const dateOptions = { locale: localeForLanguage(user.language), timeZone: user.timezone };

  const sp = await searchParams;
  const event = typeof sp.event === "string" && ["LOGIN", "LOGOUT", "LOGIN_FAILED"].includes(sp.event) ? sp.event : undefined;
  const kind = typeof sp.kind === "string" && ["USER", "SUPPLIER", "UNKNOWN"].includes(sp.kind) ? sp.kind : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const dateParam = (key: string) =>
    typeof sp[key] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp[key] as string) ? (sp[key] as string) : "";
  const from = dateParam("from");
  const to = dateParam("to");

  const [events, clients] = await Promise.all([
    prisma.loginEvent.findMany({
      where: {
        ...(event ? { event } : {}),
        ...(kind ? { kind } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { ip: { contains: q } },
              ],
            }
          : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: zonedTimeToUtc(`${from}T00:00`, user.timezone) } : {}),
                ...(to ? { lte: new Date(zonedTimeToUtc(`${to}T23:59`, user.timezone).getTime() + 59_999) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.client.findMany({ select: { id: true, code: true } }),
  ]);
  const clientCode = new Map(clients.map((c) => [c.id, c.code]));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>

      <div className="mt-6">
        <LoginLogFilters />
      </div>
      <p className="mt-3 text-xs text-slate-400">{d.showingLast.replace("{count}", String(events.length))}</p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{d.date}</th>
              <th className="px-4 py-3">{d.event}</th>
              <th className="px-4 py-3">{d.user}</th>
              <th className="px-4 py-3">{d.kind}</th>
              <th className="px-4 py-3">{d.client}</th>
              <th className="px-4 py-3">{d.method}</th>
              <th className="px-4 py-3">{d.ip}</th>
              <th className="px-4 py-3">{d.device}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {d.noRows}
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="align-top hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(e.createdAt, dateOptions)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_STYLE[e.event] ?? ""}`}>
                    {d[`event_${e.event}` as keyof typeof d] ?? e.event}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="block font-medium text-slate-800">{e.name || "—"}</span>
                  <span className="block text-xs text-slate-500">{e.email}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{d[`kind_${e.kind}` as keyof typeof d] ?? e.kind}</td>
                <td className="px-4 py-3 text-slate-600">{e.clientId ? (clientCode.get(e.clientId) ?? "—") : "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.method ? (d[`method_${e.method}` as keyof typeof d] ?? e.method) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{e.ip ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600" title={e.userAgent ?? undefined}>
                  {describeAgent(e.userAgent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
