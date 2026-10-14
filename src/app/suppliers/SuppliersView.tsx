"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { StarRating } from "@/components/StarRating";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewGroupPicker, type ViewGroupOption } from "@/components/ViewGroupPicker";
import { formatRfpNumber } from "@/lib/format";
import {
  addSupplierContact,
  createSupplier,
  deleteSupplierDocument,
  generateSupplierSummary,
  removeMyRating,
  rateSupplier,
  setContactBlocked,
  setSupplierBlocked,
  updateSupplier,
  uploadSupplierDocument,
} from "./actions";

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
  docs: { typeId: string; status: "active" | "expired" | "upcoming" }[];
  searchText: string;
};

export type SupplierDocView = {
  id: string;
  typeName: string;
  hasDates: boolean;
  status: "active" | "expired" | "upcoming";
  from: string;
  to: string;
  note: string;
  fileName: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
};

export type DocTypeOption = { id: string; name: string; hasDates: boolean };

export type SupplierDetail = {
  id: string;
  code: string;
  companyName: string;
  taxId: string;
  phone: string;
  email: string;
  contactName: string;
  contactFirstName: string;
  contactLastName: string;
  groupIds: string[];
  status: "ACTIVE" | "INACTIVE";
  ai: {
    summary: string;
    at: string;
    model: string;
    stale: boolean;
    sources: { title: string; url: string }[];
  } | null;
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
  documents: SupplierDocView[];
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
  canManageDocs,
  docTypes,
  canCreate,
  canEdit,
  canAddContacts,
  aiAvailable,
  autoSummary,
  clientId,
  viewGroups,
  isReviewer,
  language,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canAddContacts: boolean;
  aiAvailable: boolean;
  autoSummary: boolean;
  clientId: string;
  viewGroups: ViewGroupOption[];
  list: SupplierListItem[];
  detail: SupplierDetail | null;
  selectedId: string | null;
  canRate: boolean;
  canBlock: boolean;
  canManageDocs: boolean;
  docTypes: DocTypeOption[];
  isReviewer: boolean;
  language: string;
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [creating, setCreating] = useState(false);
  const [docFilter, setDocFilter] = useState<"" | "expired" | "active">("");
  const [docType, setDocType] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = list.filter((s) => {
      if (q && !s.searchText.includes(q)) return false;
      if (filter === "active") return !s.blocked && !s.inactive;
      if (filter === "blocked") return s.blocked;
      if (filter === "rated" && s.ratingCount === 0) return false;
      if (docFilter || docType) {
        const wanted = docFilter === "expired" ? "expired" : docFilter === "active" ? "active" : null;
        const hit = s.docs.some((d) => (!docType || d.typeId === docType) && (!wanted || d.status === wanted));
        if (!hit) return false;
      }
      return true;
    });
    if (sort === "rating") {
      return [...rows].sort(
        (a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) || b.ratingCount - a.ratingCount,
      );
    }
    return rows;
  }, [list, query, filter, sort, docFilter, docType]);

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
          {canCreate && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              + {t("suppliersScreen.newSupplier")}
            </button>
          )}
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
          {docTypes.length > 0 && (
            <div className="flex gap-2">
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value as "" | "expired" | "active")}
                className="w-1/2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600"
              >
                <option value="">{t("supplierDocs.filterDocsAny")}</option>
                <option value="expired">{t("supplierDocs.filterExpired")}</option>
                <option value="active">{t("supplierDocs.filterActiveDocs")}</option>
              </select>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-1/2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600"
              >
                <option value="">{t("supplierDocs.filterAnyType")}</option>
                {docTypes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
        {creating ? (
          <CreateSupplierForm
            clientId={clientId}
            viewGroups={viewGroups}
            canBlock={canBlock}
            onCancel={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              // With AI set up, the new supplier's page asks for its summary right away.
              router.push(aiAvailable ? `${hrefFor(id)}&summary=1` : hrefFor(id));
            }}
          />
        ) : detail ? (
          <SupplierPanel
            key={detail.id}
            detail={detail}
            canRate={canRate}
            canBlock={canBlock}
            canManageDocs={canManageDocs}
            canEdit={canEdit}
            canAddContacts={canAddContacts}
            canGenerate={aiAvailable && (canEdit || canCreate)}
            aiAvailable={aiAvailable}
            autoSummary={autoSummary}
            viewGroups={viewGroups}
            docTypes={docTypes}
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
  canManageDocs,
  canEdit,
  canAddContacts,
  canGenerate,
  aiAvailable,
  autoSummary,
  viewGroups,
  docTypes,
  isReviewer,
  language,
}: {
  detail: SupplierDetail;
  canRate: boolean;
  canBlock: boolean;
  canManageDocs: boolean;
  canEdit: boolean;
  canAddContacts: boolean;
  canGenerate: boolean;
  aiAvailable: boolean;
  autoSummary: boolean;
  viewGroups: ViewGroupOption[];
  docTypes: DocTypeOption[];
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [aiBusy, setAiBusy] = useState(autoSummary && aiAvailable && !detail.ai);
  const autoStarted = useRef(false);
  const searchParams = useSearchParams();

  async function loadSummary(onlyIfMissing: boolean) {
    setError(null);
    setAiBusy(true);
    const result = await generateSupplierSummary(detail.id, { onlyIfMissing });
    setAiBusy(false);
    if ("error" in result) setError(result.error);
    router.refresh();
  }

  // Right after creating a supplier the page asks for its summary once.
  useEffect(() => {
    if (!autoSummary || !aiAvailable || detail.ai || autoStarted.current) return;
    autoStarted.current = true;
    void loadSummary(true).finally(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("summary");
      router.replace(`/suppliers?${params.toString()}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(
    action: () => Promise<{ error: string } | { success: true }>,
    onOk?: string | (() => void),
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
      else {
        if (typeof onOk === "string") setNotice(onOk);
        else onOk?.();
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

      {flash && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{flash}</div>
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

      {editing ? (
        <EditSupplierForm
          detail={detail}
          viewGroups={viewGroups}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setFlash(t("suppliersScreen.editSaved"));
            router.refresh();
          }}
        />
      ) : (
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">{t("suppliersScreen.dataTitle")}</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setFlash(null);
                  setEditing(true);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t("suppliersScreen.editButton")}
              </button>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            {(
              [
                ["suppliersScreen.code", detail.code],
                ["suppliersScreen.taxId", detail.taxId],
                ["suppliersScreen.contactName", detail.contactName],
                ["suppliersScreen.email", detail.email],
                ["suppliersScreen.phone", detail.phone],
                [
                  "suppliersScreen.status",
                  detail.inactive ? t("suppliersScreen.statusInactive") : t("suppliersScreen.statusActive"),
                ],
                ["suppliersScreen.groups", detail.groups.join(", ")],
              ] as const
            ).map(([labelKey, value]) => (
              <div key={labelKey}>
                <dt className="text-xs text-slate-400">{t(labelKey)}</dt>
                <dd className="font-medium text-slate-700">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(detail.ai || aiBusy || canGenerate) && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">{t("suppliersScreen.aiTitle")}</h3>
            {canGenerate && !aiBusy && (
              <button
                type="button"
                onClick={() => {
                  if (detail.ai && !confirm(t("suppliersScreen.aiRefreshConfirm"))) return;
                  void loadSummary(false);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                {detail.ai ? t("suppliersScreen.aiRefresh") : t("suppliersScreen.aiGenerate")}
              </button>
            )}
          </div>
          {aiBusy ? (
            <p className="mt-3 animate-pulse text-sm text-slate-500">{t("suppliersScreen.aiGenerating")}</p>
          ) : detail.ai ? (
            <>
              {detail.ai.stale && (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t("suppliersScreen.aiStale")}
                </p>
              )}
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{detail.ai.summary}</p>
              {detail.ai.sources.length > 0 && (
                <div className="mt-3 text-xs text-slate-500">
                  <span className="font-medium">{t("suppliersScreen.aiSources")}: </span>
                  {detail.ai.sources.map((src, i) => (
                    <span key={src.url}>
                      {i > 0 && " · "}
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-violet-700 hover:underline">
                        {src.title.slice(0, 60)}
                      </a>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                {t("suppliersScreen.aiDisclaimer")}{" "}
                {t("suppliersScreen.aiGeneratedOn").replace("{date}", detail.ai.at).replace("{model}", detail.ai.model)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{t("suppliersScreen.aiEmpty")}</p>
          )}
        </div>
      )}

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{t("suppliersScreen.contactsTitle")}</h3>
          {canAddContacts && !addingContact && (
            <button
              type="button"
              onClick={() => {
                setFlash(null);
                setAddingContact(true);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              + {t("suppliersScreen.addContactButton")}
            </button>
          )}
        </div>
        {addingContact && (
          <AddContactForm
            directoryId={detail.id}
            onCancel={() => setAddingContact(false)}
            onAdded={(pendingApproval) => {
              setAddingContact(false);
              setFlash(
                pendingApproval ? t("suppliersScreen.contactAddedPending") : t("suppliersScreen.contactAddedSent"),
              );
              router.refresh();
            }}
          />
        )}
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
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">{t("supplierDocs.docsTitle")}</h3>
          {canManageDocs && docTypes.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFlash(null);
                setUploadOpen(true);
              }}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              + {t("supplierDocs.upload")}
            </button>
          )}
        </div>
        {detail.documents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("supplierDocs.docsEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {detail.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{doc.typeName}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        !doc.hasDates
                          ? "bg-slate-100 text-slate-600"
                          : doc.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : doc.status === "expired"
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {!doc.hasDates
                        ? t("supplierDocs.statusNoDates")
                        : doc.status === "active"
                          ? t("supplierDocs.statusActive")
                          : doc.status === "expired"
                            ? t("supplierDocs.statusExpired")
                            : t("supplierDocs.statusUpcoming")}
                    </span>
                  </span>
                  <span className="block text-xs text-slate-500">
                    {doc.fileName} · {(doc.size / 1024).toFixed(0)} KB
                    {doc.hasDates &&
                      ` · ${t("supplierDocs.validRange")
                        .replace("{from}", doc.from || t("supplierDocs.openEnded"))
                        .replace("{to}", doc.to || t("supplierDocs.openEnded"))}`}
                  </span>
                  {doc.note && <span className="mt-0.5 block whitespace-pre-line text-sm text-slate-600">{doc.note}</span>}
                  <span className="block text-[11px] text-slate-400">
                    {t("supplierDocs.uploadedBy").replace("{name}", doc.uploadedBy || "—").replace("{date}", doc.uploadedAt)}
                  </span>
                </span>
                <a
                  href={`/suppliers/documents/${doc.id}`}
                  className="text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  {t("supplierDocs.download")}
                </a>
                {canManageDocs && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(t("supplierDocs.confirmDelete").replace("{name}", doc.fileName))) return;
                      run(() => deleteSupplierDocument(doc.id));
                    }}
                    className="text-sm text-slate-400 hover:text-red-600"
                  >
                    {t("supplierDocs.delete")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManageDocs && docTypes.length === 0 && (
          <p className="mt-4 text-xs text-slate-400">{t("supplierDocs.docsNoTypes")}</p>
        )}
        {uploadOpen && (
          <UploadDocumentDialog
            directoryId={detail.id}
            docTypes={docTypes}
            onClose={() => setUploadOpen(false)}
            onUploaded={() => {
              setUploadOpen(false);
              router.refresh();
            }}
          />
        )}
      </div>

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

type SupplierFormState = {
  code: string;
  taxId: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
};

const FIELD_CLASS =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-slate-500";

// The supplier data fields, shared by the create and edit forms.
function SupplierFields({
  form,
  setForm,
  groups,
  setGroups,
  viewGroups,
}: {
  form: SupplierFormState;
  setForm: (f: SupplierFormState) => void;
  groups: string[];
  setGroups: (g: string[]) => void;
  viewGroups: ViewGroupOption[];
}) {
  const { t } = usePreferences();
  const field = FIELD_CLASS;
  const label = LABEL_CLASS;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className={label}>{t("suppliersScreen.createCode")} *</label>
        <input className={field} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
      </div>
      <div>
        <label className={label}>{t("suppliersScreen.createTaxId")} *</label>
        <input className={field} required value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>{t("suppliersScreen.createCompany")} *</label>
        <input className={field} required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
      </div>
      <div>
        <label className={label}>{t("suppliersScreen.createFirstName")}</label>
        <input className={field} value={form.contactFirstName} onChange={(e) => setForm({ ...form, contactFirstName: e.target.value })} />
      </div>
      <div>
        <label className={label}>{t("suppliersScreen.createLastName")}</label>
        <input className={field} value={form.contactLastName} onChange={(e) => setForm({ ...form, contactLastName: e.target.value })} />
      </div>
      <div>
        <label className={label}>{t("suppliersScreen.createEmail")}</label>
        <input type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <label className={label}>{t("suppliersScreen.createPhone")}</label>
        <input className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div>
        <label className={label}>{t("suppliersScreen.createStatus")}</label>
        <select
          className={field}
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}
        >
          <option value="ACTIVE">{t("suppliersScreen.createActive")}</option>
          <option value="INACTIVE">{t("suppliersScreen.createInactive")}</option>
        </select>
      </div>
      {viewGroups.length > 0 && (
        <div>
          <label className={label}>{t("suppliersScreen.createGroups")}</label>
          <ViewGroupPicker groups={viewGroups} value={groups} onChange={setGroups} />
        </div>
      )}
    </div>
  );
}

function CreateSupplierForm({
  clientId,
  viewGroups,
  canBlock,
  onCancel,
  onCreated,
}: {
  clientId: string;
  viewGroups: ViewGroupOption[];
  canBlock: boolean;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = usePreferences();
  const [form, setForm] = useState<SupplierFormState>({
    code: "",
    taxId: "",
    companyName: "",
    contactFirstName: "",
    contactLastName: "",
    email: "",
    phone: "",
    status: "ACTIVE",
  });
  const [groups, setGroups] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSupplier({ ...form, viewGroupIds: groups }, clientId);
      if ("error" in result) setError(result.error);
      else onCreated(result.id);
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{t("suppliersScreen.createTitle")}</h2>
      {!canBlock && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("suppliersScreen.createWillBeBlocked")}
        </p>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <SupplierFields form={form} setForm={setForm} groups={groups} setGroups={setGroups} viewGroups={viewGroups} />
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {t("suppliersScreen.createCancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {t("suppliersScreen.createSubmit")}
        </button>
      </div>
    </form>
  );
}

function EditSupplierForm({
  detail,
  viewGroups,
  onCancel,
  onSaved,
}: {
  detail: SupplierDetail;
  viewGroups: ViewGroupOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = usePreferences();
  const [form, setForm] = useState<SupplierFormState>({
    code: detail.code,
    taxId: detail.taxId,
    companyName: detail.companyName,
    contactFirstName: detail.contactFirstName,
    contactLastName: detail.contactLastName,
    email: detail.email,
    phone: detail.phone,
    status: detail.status,
  });
  const [groups, setGroups] = useState<string[]>(detail.groupIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateSupplier(detail.id, { ...form, viewGroupIds: groups });
      if ("error" in result) setError(result.error);
      else onSaved();
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{t("suppliersScreen.editTitle")}</h3>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <SupplierFields form={form} setForm={setForm} groups={groups} setGroups={setGroups} viewGroups={viewGroups} />
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {t("suppliersScreen.createCancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {t("suppliersScreen.editSave")}
        </button>
      </div>
    </form>
  );
}

function AddContactForm({
  directoryId,
  onCancel,
  onAdded,
}: {
  directoryId: string;
  onCancel: () => void;
  onAdded: (pendingApproval: boolean) => void;
}) {
  const { t } = usePreferences();
  const [form, setForm] = useState({ name: "", lastName: "", email: "", isAdmin: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addSupplierContact(directoryId, form);
      if ("error" in result) setError(result.error);
      else onAdded(result.pendingApproval);
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-700">{t("suppliersScreen.addContactTitle")}</p>
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL_CLASS}>{t("suppliersScreen.contactFirstName")} *</label>
          <input className={FIELD_CLASS} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("suppliersScreen.contactLastNameLabel")}</label>
          <input className={FIELD_CLASS} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("suppliersScreen.contactEmailLabel")} *</label>
          <input type="email" required className={FIELD_CLASS} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} />
        {t("suppliersScreen.contactIsAdmin")}
      </label>
      <div className="mt-3 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white">
          {t("suppliersScreen.createCancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {t("suppliersScreen.contactSubmit")}
        </button>
      </div>
    </form>
  );
}

// Popup to upload a document to a supplier's record.
function UploadDocumentDialog({
  directoryId,
  docTypes,
  onClose,
  onUploaded,
}: {
  directoryId: string;
  docTypes: DocTypeOption[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t } = usePreferences();
  const [typeId, setTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = docTypes.find((d) => d.id === typeId);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await uploadSupplierDocument(directoryId, fd);
      if ("error" in result) setError(result.error);
      else onUploaded();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-12"
      onClick={() => !pending && onClose()}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
      >
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-900">{t("supplierDocs.upload")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>
          )}
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>{t("supplierDocs.uploadType")} *</label>
            <select
              name="typeId"
              required
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">{t("supplierDocs.pickType")}</option>
              {docTypes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>{t("supplierDocs.uploadFile")} *</label>
            <input name="file" type="file" required className="block w-full text-sm text-slate-600" />
          </div>
          {selected?.hasDates && (
            <>
              <div>
                <label className={LABEL_CLASS}>{t("supplierDocs.startDate")} *</label>
                <input name="startDate" type="date" required className={FIELD_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>{t("supplierDocs.endDate")} *</label>
                <input name="endDate" type="date" required className={FIELD_CLASS} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className={LABEL_CLASS}>{t("supplierDocs.note")}</label>
            <textarea
              name="note"
              rows={3}
              maxLength={1000}
              placeholder={t("supplierDocs.notePlaceholder")}
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-4">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            {t("suppliersScreen.createCancel")}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? t("supplierDocs.uploading") : t("supplierDocs.uploadBtn")}
          </button>
        </div>
      </form>
    </div>
  );
}
