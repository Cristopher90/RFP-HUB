"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { UserMultiPicker, type PickableUser } from "@/components/UserMultiPicker";
import { utcToZonedTime } from "@/lib/timezone";
import { deleteNote, saveNote, setNoteRead } from "./actions";

export type NoteView = {
  id: string;
  body: string;
  weight: number;
  scope: "PRIVATE" | "TARGETED" | "ALL";
  startsAt: string | null;
  endsAt: string | null;
  authorName: string;
  isMine: boolean;
  canManage: boolean;
  read: boolean; // the viewer already marked it as read
  readCount: number; // how many recipients marked it as read (shown to the author)
  targetIds: string[];
  targetCount: number;
  clientLabel: string | null; // for notes that aren't from the viewer's own client (global news)
  state: "active" | "scheduled" | "expired";
};

type Filter = "all" | "mine" | "toMe" | "everyone" | "read";

const PAGE_SIZE = 4; // notes shown at a time; arrows move to the next ones

// Sticky-note colors by importance (1 calm blue → 5 urgent red).
const NOTE_COLORS: Record<number, string> = { 1: "#dbeafe", 2: "#d1fae5", 3: "#fef08a", 4: "#fdba74", 5: "#fca5a5" };
const TILTS = [-1.6, 1.1, -0.7, 1.7, -1.2, 0.6];

function inputClass() {
  return "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

type Draft = {
  id?: string;
  body: string;
  weight: number;
  scope: "PRIVATE" | "TARGETED" | "ALL";
  startsAt: string;
  endsAt: string;
  targetUserIds: string[];
  clientId: string;
};

export function NotesBoard({
  notes,
  rights,
  users,
  clients,
}: {
  notes: NoteView[];
  rights: { own: boolean; targeted: boolean; all: boolean; anyClient: boolean };
  users: PickableUser[];
  clients: { id: string; label: string }[];
}) {
  const { t, formatDate, timeZone } = usePreferences();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canWrite = rights.own || rights.targeted || rights.all;
  const firstScope: Draft["scope"] = rights.own ? "PRIVATE" : rights.targeted ? "TARGETED" : "ALL";

  // Notes already marked as read leave the other tabs and live under "Read".
  const categories: Record<Filter, (n: NoteView) => boolean> = {
    all: (n) => n.state === "active" && !n.read,
    mine: (n) => n.isMine,
    toMe: (n) => n.scope === "TARGETED" && !n.isMine && n.state === "active" && !n.read,
    everyone: (n) => n.scope === "ALL" && n.state === "active" && !n.read,
    read: (n) => !n.isMine && n.read && n.state === "active",
  };
  const ordered = notes.filter(categories[filter]).sort((a, b) => b.weight - a.weight);
  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const shown = ordered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  // Functional update so quick successive edits never overwrite each other.
  const patch = (changes: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...changes } : d));

  function openNew() {
    setError(null);
    setDraft({ body: "", weight: 3, scope: firstScope, startsAt: "", endsAt: "", targetUserIds: [], clientId: "" });
  }

  function openEdit(n: NoteView) {
    setError(null);
    setDraft({
      id: n.id,
      body: n.body,
      weight: n.weight,
      scope: n.scope,
      startsAt: n.startsAt ? utcToZonedTime(new Date(n.startsAt), timeZone) : "",
      endsAt: n.endsAt ? utcToZonedTime(new Date(n.endsAt), timeZone) : "",
      targetUserIds: n.targetIds,
      clientId: "",
    });
  }

  function submit() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await saveNote({ ...draft, clientId: draft.clientId || null });
      if ("error" in result) setError(result.error);
      else setDraft(null);
    });
  }

  function remove(n: NoteView) {
    if (!confirm(t("homeNotes.deleteConfirm"))) return;
    startTransition(async () => {
      await deleteNote(n.id);
    });
  }

  const count = (f: Filter) => notes.filter(categories[f]).length;
  const scopeLabel = (s: NoteView["scope"]) => t(`homeNotes.scope_${s}`);
  const filterButton = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      onClick={() => {
        setFilter(f);
        setPage(0);
      }}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
        filter === f ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
      }`}
    >
      {label} <span className="opacity-70">({count(f)})</span>
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterButton("all", t("homeNotes.filterAll"))}
          {filterButton("mine", t("homeNotes.filterMine"))}
          {filterButton("toMe", t("homeNotes.filterToMe"))}
          {filterButton("everyone", t("homeNotes.filterEveryone"))}
          {filterButton("read", t("homeNotes.filterRead"))}
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
          >
            {t("homeNotes.newNote")}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          {t("homeNotes.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((n, i) => (
            <article
              key={n.id}
              className="relative flex min-h-[9.5rem] flex-col rounded-sm p-4 pt-5 shadow-md transition-transform hover:z-10 hover:scale-[1.02]"
              style={{
                backgroundColor: NOTE_COLORS[n.weight],
                color: "#1e293b",
                transform: `rotate(${TILTS[i % TILTS.length]}deg)`,
                opacity: n.state === "active" ? 1 : 0.65,
              }}
            >
              {/* tape */}
              <span
                aria-hidden
                className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 rotate-2 rounded-sm"
                style={{ backgroundColor: "rgba(255,255,255,0.65)", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
              />
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide opacity-80">
                <span title={t("homeNotes.importance")}>{"★".repeat(n.weight)}{"☆".repeat(5 - n.weight)}</span>
                <span>{scopeLabel(n.scope)}{n.scope === "TARGETED" && n.isMine ? ` · ${n.targetCount}` : ""}</span>
              </div>
              <p className="flex-1 whitespace-pre-wrap break-words text-sm leading-snug">{n.body}</p>
              <div className="mt-3 space-y-0.5 text-[11px] opacity-80">
                <p>
                  {n.isMine ? t("homeNotes.byMe") : n.authorName}
                  {n.clientLabel ? ` · ${n.clientLabel}` : ""}
                </p>
                {(n.startsAt || n.endsAt) && (
                  <p>
                    {n.startsAt ? formatDate(n.startsAt) : "…"} → {n.endsAt ? formatDate(n.endsAt) : "…"}
                  </p>
                )}
                {n.state !== "active" && (
                  <p className="font-semibold">{n.state === "expired" ? t("homeNotes.expired") : t("homeNotes.scheduled")}</p>
                )}
              </div>
              {n.isMine && n.scope !== "PRIVATE" && (
                <p className="mt-1 text-[11px] font-semibold opacity-80">
                  ✓ {t("homeNotes.readBy").replace("{count}", String(n.readCount))}
                </p>
              )}
              {!n.isMine && (
                <div className="mt-2 flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await setNoteRead(n.id, !n.read);
                      })
                    }
                    className="underline"
                  >
                    {n.read ? t("homeNotes.markUnread") : t("homeNotes.markRead")}
                  </button>
                </div>
              )}
              {n.canManage && (
                <div className="mt-2 flex gap-3 text-xs font-medium">
                  <button type="button" onClick={() => openEdit(n)} className="underline">
                    {t("homeNotes.edit")}
                  </button>
                  <button type="button" disabled={pending} onClick={() => remove(n)} className="underline">
                    {t("homeNotes.delete")}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-slate-600">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            aria-label={t("homeNotes.previous")}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-30"
          >
            ‹
          </button>
          <span className="tabular-nums">
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
            disabled={currentPage >= pageCount - 1}
            aria-label={t("homeNotes.next")}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-10" onClick={() => setDraft(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                {draft.id ? t("homeNotes.editNote") : t("homeNotes.newNote")}
              </h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("homeNotes.text")}</label>
                <textarea
                  className={inputClass()}
                  rows={4}
                  maxLength={1000}
                  value={draft.body}
                  onChange={(e) => patch({ body: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("homeNotes.importance")}</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => patch({ weight: w })}
                      className={`h-9 w-9 rounded-md text-sm font-semibold ${draft.weight === w ? "ring-2 ring-violet-600" : "ring-1 ring-slate-300"}`}
                      style={{ backgroundColor: NOTE_COLORS[w], color: "#1e293b" }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("homeNotes.visibleFor")}</label>
                <select
                  className={inputClass()}
                  value={draft.scope}
                  onChange={(e) => patch({ scope: e.target.value as Draft["scope"] })}
                >
                  {rights.own && <option value="PRIVATE">{t("homeNotes.scopeOptionPrivate")}</option>}
                  {rights.targeted && <option value="TARGETED">{t("homeNotes.scopeOptionTargeted")}</option>}
                  {rights.all && <option value="ALL">{t("homeNotes.scopeOptionAll")}</option>}
                </select>
              </div>
              {draft.scope === "TARGETED" && (
                <UserMultiPicker
                  users={users}
                  selectedIds={draft.targetUserIds}
                  onChange={(ids) => patch({ targetUserIds: ids })}
                  placeholder={t("homeNotes.pickUsers")}
                />
              )}
              {draft.scope === "ALL" && rights.anyClient && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("homeNotes.client")}</label>
                  <select className={inputClass()} value={draft.clientId} onChange={(e) => patch({ clientId: e.target.value })}>
                    <option value="">{t("homeNotes.allClients")}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("homeNotes.startsAt")}</label>
                  <input type="datetime-local" className={inputClass()} value={draft.startsAt} onChange={(e) => patch({ startsAt: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("homeNotes.endsAt")}</label>
                  <input type="datetime-local" className={inputClass()} value={draft.endsAt} onChange={(e) => patch({ endsAt: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-slate-400">{t("homeNotes.datesHint")}</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={() => setDraft(null)} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                {t("homeNotes.cancel")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {pending ? t("homeNotes.saving") : t("homeNotes.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
