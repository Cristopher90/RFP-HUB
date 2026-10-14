"use client";

import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { MentionSuggestion } from "@/lib/mentions";
import { searchMentions } from "./actions";

const KIND_BADGE: Record<MentionSuggestion["kind"], string> = {
  RFP: "bg-violet-100 text-violet-700",
  DOC: "bg-amber-100 text-amber-700",
  PRV: "bg-emerald-100 text-emerald-700",
};

// Textarea where typing "@" offers RFPs, requests (documents) and suppliers by id;
// picking one inserts a token such as "@RFP-123" that becomes a link in the note.
export function MentionTextarea({
  value,
  onChange,
  className,
  maxLength,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  maxLength?: number;
  rows?: number;
}) {
  const { t } = usePreferences();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [items, setItems] = useState<MentionSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  // Look up suggestions shortly after the user stops typing the query.
  useEffect(() => {
    if (!trigger || trigger.query.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchMentions(trigger.query);
        if (!cancelled) {
          setItems(found);
          setActive(0);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trigger]);

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret);
    const m = /(?:^|[\s(])@([A-Za-z0-9._/-]{0,40})$/.exec(before);
    setTrigger(m ? { start: caret - m[1].length - 1, query: m[1] } : null);
  }

  function pick(item: MentionSuggestion) {
    if (!trigger) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, trigger.start)}${item.token} ${value.slice(caret)}`;
    onChange(next);
    setTrigger(null);
    setItems([]);
    const pos = trigger.start + item.token.length + 1;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!trigger || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setTrigger(null);
    }
  }

  const showList = trigger !== null && trigger.query.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className={className}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onClick={(e) => detect(e.currentTarget.value, e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setTrigger(null), 150)}
      />
      {showList && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {items.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-400">
              {searching ? t("homeNotes.mentionSearching") : t("homeNotes.mentionNone")}
            </li>
          ) : (
            items.map((item, i) => (
              <li key={item.token}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(item);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${i === active ? "bg-violet-50" : ""}`}
                >
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${KIND_BADGE[item.kind]}`}>
                    {t(`homeNotes.mentionKind_${item.kind}`)}
                  </span>
                  <span className="font-medium text-slate-800">{item.label}</span>
                  <span className="truncate text-xs text-slate-500">{item.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-400">{t("homeNotes.mentionHint")}</p>
    </div>
  );
}
