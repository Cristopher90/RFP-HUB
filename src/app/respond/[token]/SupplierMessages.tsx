"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { ChatThread } from "@/components/ChatThread";
import type { ChatMessage } from "@/lib/rfpMessages";
import { markSupplierThreadRead, sendSupplierMessage } from "./messageActions";

// The supplier's side of the RFP chat: one conversation with the buyer.
export function SupplierMessages({ token, messages }: { token: string; messages: ChatMessage[] }) {
  const { t } = usePreferences();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const unread = messages.filter((m) => m.sender === "BUYER" && !m.read).length;
  useEffect(() => {
    if (unread === 0) return;
    markSupplierThreadRead(token).then(() => router.refresh());
  }, [unread, token, router]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await sendSupplierMessage(token, text);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">{t("rfpMessages.subtitleSupplier")}</p>
      <ChatThread messages={messages} viewer="SUPPLIER" />
      <div className="mt-4 border-t border-slate-100 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t("rfpMessages.placeholder")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs">{error ? <span className="text-red-600">{error}</span> : <span className="text-slate-400">{text.length}/2000</span>}</span>
          <button
            type="button"
            disabled={pending || !text.trim()}
            onClick={send}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? t("rfpMessages.sending") : t("rfpMessages.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
