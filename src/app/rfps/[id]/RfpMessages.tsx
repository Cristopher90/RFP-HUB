"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { ChatThread } from "@/components/ChatThread";
import type { ChatMessage } from "@/lib/rfpMessages";
import { markBuyerThreadRead, sendBuyerMessage } from "./messageActions";

type SupplierRow = { invitationId: string; name: string; company: string };

// The buyer's side of the RFP chat: pick a supplier to read its conversation,
// and choose which suppliers (one, several or all) a new message goes to.
export function RfpMessages({
  rfpId,
  canSend,
  suppliers,
  threads,
}: {
  rfpId: string;
  canSend: boolean;
  suppliers: SupplierRow[];
  threads: Record<string, ChatMessage[]>;
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [text, setText] = useState("");

  const unread = (id: string) => (threads[id] ?? []).filter((m) => m.sender === "SUPPLIER" && !m.read).length;
  const lastAt = (id: string) => (threads[id] ?? []).at(-1)?.createdAt ?? "";
  const ordered = useMemo(
    () => [...suppliers].sort((a, b) => unread(b.invitationId) - unread(a.invitationId) || lastAt(b.invitationId).localeCompare(lastAt(a.invitationId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suppliers, threads],
  );

  const [selected, setSelected] = useState<string>(() => ordered[0]?.invitationId ?? "");
  const [recipients, setRecipients] = useState<Set<string>>(() => new Set(ordered[0] ? [ordered[0].invitationId] : []));

  // Opening a conversation marks what the supplier wrote as read.
  const unreadHere = selected ? unread(selected) : 0;
  useEffect(() => {
    if (!selected || unreadHere === 0) return;
    markBuyerThreadRead(rfpId, selected).then(() => router.refresh());
  }, [selected, unreadHere, rfpId, router]);

  // New replies show up without reloading.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  function pick(id: string) {
    setSelected(id);
    setRecipients(new Set([id]));
    setError(null);
    setNotice(null);
  }

  function toggle(id: string) {
    setRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function send() {
    setError(null);
    setNotice(null);
    const ids = [...recipients];
    startTransition(async () => {
      const result = await sendBuyerMessage(rfpId, ids, text);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setText("");
      setNotice(ids.length > 1 ? t("rfpMessages.sentMany").replace("{n}", String(ids.length)) : t("rfpMessages.sent"));
      router.refresh();
    });
  }

  if (suppliers.length === 0) return <p className="text-sm text-slate-500">{t("rfpMessages.noSuppliers")}</p>;
  const current = suppliers.find((s) => s.invitationId === selected);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">{t("rfpMessages.subtitleBuyer")}</p>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-500">{t("rfpMessages.selectSupplier")}</p>
          <ul className="space-y-1">
            {ordered.map((s) => {
              const n = unread(s.invitationId);
              const on = s.invitationId === selected;
              return (
                <li key={s.invitationId}>
                  <button
                    type="button"
                    onClick={() => pick(s.invitationId)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                      on ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.company || s.name}</span>
                      {s.company && <span className="block truncate text-xs text-slate-400">{s.name}</span>}
                    </span>
                    {n > 0 && (
                      <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white" title={t("rfpMessages.unread")}>
                        {n}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">{current ? current.company || current.name : ""}</p>
          <ChatThread messages={selected ? (threads[selected] ?? []) : []} viewer="BUYER" />

          {canSend && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">{t("rfpMessages.sendTo")}:</span>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={recipients.size === suppliers.length}
                    onChange={(e) => setRecipients(new Set(e.target.checked ? suppliers.map((s) => s.invitationId) : []))}
                  />
                  {t("rfpMessages.allSuppliers")}
                </label>
                {suppliers.map((s) => (
                  <label key={s.invitationId} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={recipients.has(s.invitationId)} onChange={() => toggle(s.invitationId)} />
                    {s.company || s.name}
                  </label>
                ))}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t("rfpMessages.placeholder")}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs">
                  {error ? <span className="text-red-600">{error}</span> : notice ? <span className="text-emerald-700">{notice}</span> : <span className="text-slate-400">{text.length}/2000</span>}
                </span>
                <button
                  type="button"
                  disabled={pending || !text.trim() || recipients.size === 0}
                  onClick={send}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {pending ? t("rfpMessages.sending") : t("rfpMessages.send")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
