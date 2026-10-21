"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { Artifact } from "@/lib/assistant/tools";
import type { FormChange, FormSnapshot } from "@/lib/assistant/formChanges";
import { askRfpAssistant } from "./assistantActions";

type Message = { role: "user" | "assistant"; text: string; artifacts?: Artifact[]; error?: boolean };

const SEVERITY_STYLE = {
  error: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-sky-100 text-sky-700",
} as const;

// A floating assistant for the RFP form: it reads what is typed so far, checks
// it and proposes changes. It never edits the form by itself — every change
// waits for the user to press Aplicar.
export function RfpAssistantPanel({
  getSnapshot,
  onApply,
}: {
  getSnapshot: () => FormSnapshot;
  onApply: (change: FormChange) => void;
}) {
  const { t, formatCurrency } = usePreferences();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, open]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;
    const next: Message[] = [...messages, { role: "user", text: clean }];
    setMessages(next);
    setInput("");
    const snapshot = getSnapshot();
    startTransition(async () => {
      const result = await askRfpAssistant(
        next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })),
        snapshot,
      );
      setMessages((prev) =>
        "reply" in result
          ? [...prev, { role: "assistant", text: result.reply, artifacts: result.artifacts }]
          : [...prev, { role: "assistant", text: result.error, error: true }],
      );
    });
  }

  function apply(key: string, change: FormChange) {
    if (applied.has(key)) return;
    onApply(change);
    setApplied((prev) => new Set(prev).add(key));
  }

  function describe(change: FormChange): string {
    if (change.kind === "field") {
      const value = change.field === "estimatedPrice" && Number.isFinite(Number(change.value)) ? formatCurrency(Number(change.value)) : change.value;
      return `${t("rfpAssistant.setField")} ${t(`rfpAssistant.field_${change.field}`).toLowerCase()}: ${value}`;
    }
    if (change.kind === "item") {
      return `${t("rfpAssistant.addItem")}: ${change.name} × ${change.quantity} ${change.unit}`;
    }
    return `${t("rfpAssistant.addQuestion")}: ${change.text} (${t(`rfpAssistant.qType_${change.type}`).toLowerCase()}${change.required ? `, ${t("rfpAssistant.required")}` : ""})`;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-700"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="m6.3 6.3 2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" />
          <circle cx="12" cy="12" r="1.6" />
        </svg>
        {t("rfpAssistant.open")}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={t("rfpAssistant.title")}
      className="fixed bottom-6 right-6 z-50 flex h-[min(36rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">{t("rfpAssistant.title")}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("rfpAssistant.close")} className="text-slate-400 hover:text-slate-700">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-500">{t("rfpAssistant.intro")}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["chipValidate", "promptValidate"],
                  ["chipItems", "promptItems"],
                  ["chipQuestions", "promptQuestions"],
                ] as const
              ).map(([chip, prompt]) => (
                <button
                  key={chip}
                  type="button"
                  disabled={pending}
                  onClick={() => send(t(`rfpAssistant.${prompt}`))}
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                >
                  {t(`rfpAssistant.${chip}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"}>
            <div
              className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "bg-violet-600 text-white"
                  : m.error
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.text}
            </div>
            {m.artifacts?.map((a, ai) => {
              if (a.type === "validation") {
                return (
                  <div key={ai} className="w-full rounded-xl border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-700">{t("rfpAssistant.validationTitle")}</p>
                    <ul className="space-y-1.5">
                      {a.issues.map((issue, k) => (
                        <li key={k} className="flex items-start gap-2 text-xs text-slate-700">
                          <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_STYLE[issue.severity]}`}>
                            {t(`rfpAssistant.severity_${issue.severity}`)}
                          </span>
                          <span>
                            {issue.field && <strong className="font-semibold">{issue.field}: </strong>}
                            {issue.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (a.type === "formChanges") {
                const keys = a.changes.map((_, k) => `${a.id}:${k}`);
                const allDone = keys.every((k) => applied.has(k));
                return (
                  <div key={ai} className="w-full rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">{a.summary || t("rfpAssistant.proposedChanges")}</p>
                      <button
                        type="button"
                        disabled={allDone}
                        onClick={() => a.changes.forEach((c, k) => apply(keys[k], c))}
                        className="shrink-0 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:bg-slate-300"
                      >
                        {allDone ? t("rfpAssistant.applied") : t("rfpAssistant.applyAll")}
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {a.changes.map((c, k) => (
                        <li key={k} className="flex items-start justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-xs text-slate-700">
                          <span className="min-w-0 break-words">{describe(c)}</span>
                          <button
                            type="button"
                            disabled={applied.has(keys[k])}
                            onClick={() => apply(keys[k], c)}
                            className="shrink-0 text-[11px] font-semibold text-violet-600 hover:text-violet-700 disabled:text-slate-400"
                          >
                            {applied.has(keys[k]) ? t("rfpAssistant.applied") : t("rfpAssistant.apply")}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {a.warnings.length > 0 && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        {t("rfpAssistant.discarded")}: {a.warnings.length}
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
        {pending && <p className="text-xs text-slate-400">{t("rfpAssistant.thinking")}</p>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 p-3">
        {messages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(
              [
                ["chipValidate", "promptValidate"],
                ["chipItems", "promptItems"],
                ["chipQuestions", "promptQuestions"],
              ] as const
            ).map(([chip, prompt]) => (
              <button
                key={chip}
                type="button"
                disabled={pending}
                onClick={() => send(t(`rfpAssistant.${prompt}`))}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {t(`rfpAssistant.${chip}`)}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // This panel sits inside the RFP form: Enter must send, never submit the form.
              if (e.key === "Enter") {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={t("rfpAssistant.placeholder")}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            type="button"
            disabled={pending || !input.trim()}
            onClick={() => send(input)}
            className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {t("rfpAssistant.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
