"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { StarRating } from "@/components/StarRating";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRfpNumber } from "@/lib/format";
import { removeMyRating, rateSupplier, setContactBlocked, setSupplierBlocked } from "./actions";

export type SupplierListItem = {
  id: string;
  code: string;
  companyName: string;
  taxId: string;
  blocked: boolean;
  inactive: boolean;
  contactCount: number;
  ratingAvg: number | null;
  ratingCount: number;
  searchText: string;
};

export type SupplierDetail = {
  id: string;
  code: string;
  companyName: string;
  taxId: string;
  phone: string;
  email: string;
  contactName: string;
  blocked: boolean;
  inactive: boolean;
  groups: string[];
  rating: { avg: number; count: number } | null;
  myRating: { stars: number; comment: string } | null;
  comments: { id: string; author: string; stars: number; comment: string; date: string; mine: boolean }[];
  contacts: {
    linkId: string;
    name: string;
    email: string;
    status: "PENDING_APPROVAL" | "SENT" | "ACCEPTED";
    isAdmin: boolean;
    blocked: boolean;
  }[];
  processes: {
    rfpId: string;
    number: number;
    title: string;
    status: string;
    invited: number;
    responded: number;
  }[];
};

type Filter = "all" | "active" | "blocked" | "rated";
type Sort = "name" | "rating";

// Order of the status groups in "my processes".
const STATUS_ORDER = ["OPEN", "AWAITING_START", "PENDING_PUBLISH_APPROVAL", "DRAFT", "CLOSED"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function SuppliersView({
  list,
  detail,
  selectedId,
  canRate,
  canBlock,
  isReviewer,
  language,
}: {
  list: SupplierListItem[];
  detail: SupplierDetail | null;
  selectedId: string | null;
  canRate: boolean;
  canBlock: boolean;
  isReviewer: boolean;
  language: string;
}) {
  const { t } = usePreferences();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = list.filter((s) => {
      if (q && !s.searchText.includes(q)) return false;
      if (filter === "active") return !s.blocked && !s.inactive;
      if (filter === "blocked") return s.blocked;
      if (filter === "rated") return s.ratingCount > 0;
      return true;
    });
    if (sort === "rating") {
      return [...rows].sort(
        (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) || b.ratingCount - a.ratingCount,
      );
    }
    return rows;
  }, [list, query, filter, sort]);

  function hrefFor(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    return `${pathname}?${params.toString()}`;
  }

  const chip = (value: Filter, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        filter === value
          ? "bg-violet-600 text-white"
          : "border border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="rounded-xl border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100vh-14rem)] lg:overflow-hidden">
        <div className="space-y-3 border-b border-slate-200 p-4">
          <input
            type="search"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder={t("suppliersScreen.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {chip("all", t("suppliersScreen.filterAll"))}
            {chip("active", t("suppliersScreen.filterActive"))}
            {chip("blocked", t("suppliersScreen.filterBlocked"))}
            {chip("rated", t("suppliersScreen.filterRated"))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600"
          >
            <option value="name">{t("suppliersScreen.sortName")}</option>
            <option value="rating">{t("suppliersScreen.sortRating")}</option>
          </select>
        </div>
        <ul className="divide-y divide-slate-100 lg:max-h-[calc(100vh-24rem)] lg:overflow-y-auto">
          {visible.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-400">{t("suppliersScreen.noSuppliers")}</li>
          )}
          {visible.map((s) => (
            <li key={s.id}>
              <Link
                href={hrefFor(s.id)}
                scroll={false}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 ${
                  s.id === selectedId ? "bg-violet-50" : ""
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    s.blocked ? "bg-red-100 text-red-600" : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {initials(s.companyName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{s.companyName}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <span>{s.code}</span>
                    {s.ratingAvg !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <StarRating value={s.ratingAvg} size={12} />
                        {s.ratingAvg.toFixed(1)}
                      </span>
                    ) : null}
                  </span>
                </span>
                {s.blocked && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600">
                    {t("suppliersScreen.blocked")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        {detail ? (
          <SupplierPanel
            key={detail.id}
            detail={detail}
            canRate={canRate}
            canBlock={canBlock}
            isReviewer={isReviewer}
            language={language}
          />
        ) : (
          <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            {t("suppliersScreen.pickSupplier")}
          </div>
        )}
      </section>
    </div>
  );
}

function SupplierPanel({
  detail,
  canRate,
  canBlock,
  isReviewer,
  language,
}: {
  detail: SupplierDetail;
  canRate: boolean;
  canBlock: boolean;
  isReviewer: boolean;
  language: string;
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [stars, setStars] = useState(detail.myRating?.stars ?? 0);
  const [comment, setComment] = useState(detail.myRating?.comment ?? "");

  function run(action: () => Promise<{ error: string } | { success: true }>, okMessage?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
      else {
        if (okMessage) setNotice(okMessage);
        router.refresh();
      }
    });
  }

  function toggleSupplierBlock() {
    if (!detail.blocked && !confirm(t("suppliersScreen.confirmBlockSupplier").replace("{name}", detail.companyName))) {
      return;
    }
    run(() => setSupplierBlocked(detail.id, !detail.blocked));
  }

  function toggleContactBlock(c: SupplierDetail["contacts"][number]) {
    if (!c.blocked && !confirm(t("suppliersScreen.confirmBlockContact").replace("{name}", c.name || c.email))) return;
    run(() => setContactBlocked(c.linkId, !c.blocked));
  }

  const ratingText = detail.rating
    ? detail.rating.count === 1
      ? t("suppliersScreen.ratingOne").replace("{avg}", detail.rating.avg.toFixed(1))
      : t("suppliersScreen.ratingAverage")
          .replace("{avg}", detail.rating.avg.toFixed(1))
          .replace("{count}", String(detail.rating.count))
    : t("suppliersScreen.noRatings");

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: detail.processes.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);

  const card = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";
  const contactStatus = (s: SupplierDetail["contacts"][number]["status"]) =>
    s === "ACCEPTED"
      ? t("suppliersScreen.contactAccepted")
      : s === "SENT"
        ? t("suppliersScreen.contactSent")
        : t("suppliersScreen.contactPending");

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold ${
                detail.blocked ? "bg-red-100 text-red-600" : "bg-violet-100 text-violet-700"
              }`}
            >
              {initials(detail.companyName)}
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{detail.companyName}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {t("suppliersScreen.code")} {detail.code}
                {detail.taxId && ` · ${t("suppliersScreen.taxId")} ${detail.taxId}`}
                {detail.phone && ` · ${detail.phone}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StarRating value={detail.rating?.avg ?? 0} size={18} />
                <span className="text-sm text-slate-600">{ratingText}</span>
                {detail.blocked && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                    {t("suppliersScreen.blocked")}
                  </span>
                )}
                {detail.groups.map((g) => (
                  <span key={g} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {canBlock && (
            <button
              type="button"
              disabled={pending}
              onClick={toggleSupplierBlock}
              className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                detail.blocked
                  ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  : "border-red-300 text-red-600 hover:bg-red-50"
              }`}
            >
              {detail.blocked ? t("suppliersScreen.unblock") : t("suppliersScreen.block")}
            </button>
          )}
        </div>
        {detail.blocked && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {t("suppliersScreen.supplierBlockedNote")}
          </p>
        )}
      </div>

      <div className={card}>
        <h3 className="text-base font-semibold text-slate-900">{t("suppliersScreen.contactsTitle")}</h3>
        {detail.contacts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("suppliersScreen.noContacts")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {detail.contacts.map((c) => (
              <li key={c.linkId} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                    c.blocked ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {initials(c.name || c.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{c.name || "—"}</span>
                  <span className="block truncate text-xs text-slate-500">{c.email}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      c.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {contactStatus(c.status)}
                  </span>
                  {c.isAdmin && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
                      {t("suppliersScreen.contactAdmin")}
                    </span>
                  )}
                  {c.blocked && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600">
                      {t("suppliersScreen.blocked")}
                    </span>
                  )}
                </span>
                {canBlock && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggleContactBlock(c)}
                    className={`text-sm font-medium disabled:opacity-60 ${
                      c.blocked ? "text-emerald-700 hover:text-emerald-800" : "text-red-600 hover:text-red-700"
                    }`}
                  >
                    {c.blocked ? t("suppliersScreen.unblockContact") : t("suppliersScreen.blockContact")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canRate && (
        <div className={card}>
          <h3 className="text-base font-semibold text-slate-900">{t("suppliersScreen.yourRating")}</h3>
          <div className="mt-3">
            <StarRating value={stars} onChange={setStars} size={28} label={t("suppliersScreen.yourRating")} />
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            {t("suppliersScreen.yourComment")}
          </label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (stars < 1) {
                  setError(t("suppliersScreen.pickStars"));
                  return;
                }
                run(() => rateSupplier(detail.id, stars, comment), t("suppliersScreen.ratingSaved"));
              }}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {t("suppliersScreen.saveRating")}
            </button>
            {detail.myRating && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setStars(0);
                  setComment("");
                  run(() => removeMyRating(detail.id));
                }}
                className="text-sm text-slate-500 hover:text-red-600"
              >
                {t("suppliersScreen.clearRating")}
              </button>
            )}
            {notice && <span className="text-sm text-emerald-600">{notice}</span>}
          </div>
        </div>
      )}

      {isReviewer && (
        <div className={card}>
          <h3 className="text-base font-semibold text-slate-900">{t("suppliersScreen.commentsTitle")}</h3>
          <p className="mt-1 text-xs text-slate-500">{t("suppliersScreen.commentsAdminHint")}</p>
          {detail.comments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{t("suppliersScreen.noComments")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {detail.comments.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={c.stars} size={14} />
                    <span className="text-sm font-medium text-slate-800">{c.author}</span>
                    <span className="text-xs text-slate-400">{c.date}</span>
                  </div>
                  {c.comment && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{c.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={card}>
        <h3 className="text-base font-semibold text-slate-900">
          {isReviewer ? t("suppliersScreen.processesAdminTitle") : t("suppliersScreen.processesTitle")}
        </h3>
        {grouped.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("suppliersScreen.noProcesses")}</p>
        ) : (
          <div className="mt-3 space-y-5">
            {grouped.map((g) => (
              <div key={g.status}>
                <div className="flex items-center gap-2">
                  <StatusBadge status={g.status} language={language} />
                  <span className="text-xs text-slate-400">{g.items.length}</span>
                </div>
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {g.items.map((p) => (
                    <li key={p.rfpId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                        {formatRfpNumber(p.number)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{p.title}</span>
                      {p.responded > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          ✓ {t("suppliersScreen.responded")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          {t("suppliersScreen.notResponded")}
                        </span>
                      )}
                      <Link
                        href={`/rfps/${p.rfpId}`}
                        className="text-sm font-medium text-violet-600 hover:text-violet-700"
                      >
                        {t("suppliersScreen.viewRfp")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
