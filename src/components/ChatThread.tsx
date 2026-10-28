"use client";

import { useEffect, useRef } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { ChatMessage } from "@/lib/rfpMessages";

// A conversation as chat bubbles: the viewer's own messages on the right, the
// other side's on the left, each with who wrote it and when.
export function ChatThread({ messages, viewer }: { messages: ChatMessage[]; viewer: "BUYER" | "SUPPLIER" }) {
  const { t, formatDateTime } = usePreferences();
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view by scrolling the conversation box only, never the page.
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{t("rfpMessages.noMessages")}</p>;
  }
  return (
    <div ref={boxRef} className="max-h-96 space-y-3 overflow-y-auto pr-1">
      {messages.map((m) => {
        const mine = m.sender === viewer;
        return (
          <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                mine ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.body}
            </div>
            <span className="mt-1 px-1 text-[11px] text-slate-400">
              {mine ? t("rfpMessages.you") : m.senderName} · {formatDateTime(m.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
