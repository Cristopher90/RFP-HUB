"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type OrgUser = {
  id: string;
  name: string;
  role: string;
  supervisorId: string | null;
  approvalLimit: number | null;
  currency: string;
  clientLabel: string;
};

type Node = OrgUser & { children: Node[] };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Card({ node }: { node: Node }) {
  const { t, formatCurrency } = usePreferences();
  return (
    <Link
      href={`/admin/users/${node.id}`}
      className="inline-block w-52 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm hover:border-violet-400"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
          {initials(node.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-800">{node.name}</span>
          <span className="block truncate text-xs text-slate-500">{node.role}</span>
        </span>
      </span>
      <span
        className={`mt-2 block rounded-md px-2 py-1 text-xs font-medium ${
          node.approvalLimit === null ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {node.approvalLimit === null
          ? t("usersPage.treeNoLimit")
          : t("usersPage.treeUpTo").replace("{amount}", formatCurrency(node.approvalLimit, node.currency))}
      </span>
      {node.children.length > 0 && (
        <span className="mt-1.5 block text-[11px] text-slate-400">{t("usersPage.treeReports").replace("{n}", String(node.children.length))}</span>
      )}
    </Link>
  );
}

function Branch({ node }: { node: Node }) {
  return (
    <li>
      <Card node={node} />
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Branch key={c.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Supervision chains as an org chart: each person under their supervisor, with
// the RFP amount they can approve. Whoever has neither a supervisor nor people
// reporting to them is listed apart, below.
export function UsersOrgChart({ users }: { users: OrgUser[] }) {
  const { t } = usePreferences();

  const groups = useMemo(() => {
    const byClient = new Map<string, OrgUser[]>();
    for (const u of users) byClient.set(u.clientLabel, [...(byClient.get(u.clientLabel) ?? []), u]);
    return [...byClient.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([clientLabel, list]) => {
      const nodes = new Map<string, Node>(list.map((u) => [u.id, { ...u, children: [] }]));
      const roots: Node[] = [];
      for (const n of nodes.values()) {
        const parent = n.supervisorId ? nodes.get(n.supervisorId) : undefined;
        if (parent && parent.id !== n.id) parent.children.push(n);
        else roots.push(n);
      }
      // A loop in the data (should not exist) would leave people unreachable: show them as roots.
      const reachable = new Set<string>();
      const walk = (n: Node) => {
        if (reachable.has(n.id)) return;
        reachable.add(n.id);
        n.children.forEach(walk);
      };
      roots.forEach(walk);
      for (const n of nodes.values()) if (!reachable.has(n.id)) { n.children = n.children.filter((c) => reachable.has(c.id)); roots.push(n); walk(n); }
      const sort = (n: Node) => { n.children.sort((a, b) => a.name.localeCompare(b.name)); n.children.forEach(sort); };
      roots.forEach(sort);
      roots.sort((a, b) => a.name.localeCompare(b.name));
      return {
        clientLabel,
        trees: roots.filter((r) => r.children.length > 0),
        alone: roots.filter((r) => r.children.length === 0),
      };
    });
  }, [users]);

  const anyTree = groups.some((g) => g.trees.length > 0);

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">{t("usersPage.treeIntro")}</p>
      {!anyTree && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{t("usersPage.treeEmpty")}</p>}
      {groups.map((g) => (
        <section key={g.clientLabel} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {groups.length > 1 && <h2 className="mb-4 text-base font-semibold text-slate-900">{g.clientLabel || t("usersPage.treeNoClient")}</h2>}
          {g.trees.length > 0 && (
            <div className="space-y-8 overflow-x-auto pb-2">
              {g.trees.map((root) => (
                <div key={root.id} className="org-tree mx-auto w-max min-w-full">
                  <ul>
                    <Branch node={root} />
                  </ul>
                </div>
              ))}
            </div>
          )}
          {g.alone.length > 0 && (
            <div className={g.trees.length > 0 ? "mt-8 border-t border-slate-100 pt-5" : ""}>
              <h3 className="text-sm font-semibold text-slate-700">{t("usersPage.treeNoSupervisorTitle")}</h3>
              <p className="mt-0.5 mb-3 text-xs text-slate-500">{t("usersPage.treeNoSupervisorHint")}</p>
              <div className="flex flex-wrap gap-3">
                {g.alone.map((n) => (
                  <Card key={n.id} node={n} />
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
