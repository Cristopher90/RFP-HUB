"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { RobotMascot } from "@/components/RobotMascot";
import { Chart } from "@/components/charts/ChartKit";
import type { Artifact } from "@/lib/assistant/tools";
import { askAssistant, confirmProposal, discardProposal } from "./actions";

type Message = { role: "user" | "assistant"; text: string; artifacts?: Artifact[]; error?: boolean };
type ProposalState = { status: "pending" | "working" | "created" | "discarded" | "error"; rfpId?: string; number?: number; message?: string };

export function AssistantChat({ currency }: { currency: string }) {
  const { t, formatCurrency } = usePreferences();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [proposals, setProposals] = useState<Record<string, ProposalState>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;
    const next: Message[] = [...messages, { role: "user", text: clean }];
    setMessages(next);
    setInput("");
    startTransition(async () => {
      const result = await askAssistant(next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })));
      setMessages((prev) =>
        "reply" in result
          ? [...prev, { role: "assistant", text: result.reply, artifacts: result.artifacts }]
          : [...prev, { role: "assistant", text: result.error, error: true }],
      );
    });
  }

  function setProposal(id: string, state: ProposalState) {
    setProposals((prev) => ({ ...prev, [id]: state }));
  }

  async function create(id: string) {
    setProposal(id, { status: "working" });
    const result = await confirmProposal(id);
    if ("error" in result) setProposal(id, { status: "error", message: result.error });
    else setProposal(id, { status: "created", rfpId: result.rfpId, number: result.number });
  }

  async function discard(id: string) {
    await discardProposal(id);
    setProposal(id, { status: "discarded" });
  }

  const formatter = (format: "number" | "currency" | "percent") => (v: number) =>
    format === "currency" ? formatCurrency(v, currency) : format === "percent" ? `${Math.round(v * 10) / 10}%` : String(Math.round(v * 100) / 100);

  function renderArtifact(a: Artifact, key: string) {
    if (a.type === "chart") {
      return (
        <div key={key} className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">{a.title}</p>
          <Chart type={a.chartType} data={a.data} format={formatter(a.format)} />
        </div>
      );
    }
    if (a.type === "table") {
      return (
        <div key={key} className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <p className="px-4 pt-3 text-sm font-semibold text-slate-800">{a.title}</p>
          <table className="mt-2 min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-medium uppercase tracking-wide text-slate-500">
              <tr>{a.columns.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-700">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    // Form artifacts only appear inside the RFP form's own assistant.
    if (a.type !== "proposal") return null;
    const state = proposals[a.id] ?? { status: "pending" as const };
    const s = a.summary;
    return (
      <div key={key} className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{t("assistantPage.draftProposal")}</p>
        <p className="mt-1 text-base font-semibold text-slate-900">{s.title}</p>
        {s.description && <p className="mt-1 text-slate-600">{s.description}</p>}
        <p className="mt-2 text-xs text-slate-500">
          {[s.commodity, s.region, `${t("assistantPage.deadline")}: ${s.deadline}`].filter(Boolean).join(" · ")}
        </p>
        <ul className="mt-2 space-y-0.5 text-slate-700">
          {s.items.map((i, idx) => (
            <li key={idx}>
              • {i.quantity} {i.unit} — {i.name}
              {i.historicalPrice !== null ? ` (${formatCurrency(i.historicalPrice, currency)})` : ""}
            </li>
          ))}
        </ul>
        {s.questions.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {t("assistantPage.questions")}: {s.questions.map((q) => q.text).join(" · ")}
          </p>
        )}
        {s.warnings.map((w) => (
          <p key={w} className="mt-1 text-xs text-amber-700">⚠ {w}</p>
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {state.status === "created" ? (
            <>
              <span className="text-sm font-medium text-emerald-700">✓ {t("assistantPage.draftCreated").replace("{number}", String(state.number))}</span>
              <Link href={`/rfps/${state.rfpId}/edit`} className="text-sm font-medium text-violet-700 underline">
                {t("assistantPage.openDraft")}
              </Link>
            </>
          ) : state.status === "discarded" ? (
            <span className="text-sm text-slate-500">{t("assistantPage.discarded")}</span>
          ) : (
            <>
              <button
                type="button"
                disabled={state.status === "working"}
                onClick={() => create(a.id)}
                className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {state.status === "working" ? t("assistantPage.creating") : t("assistantPage.createDraft")}
              </button>
              <button type="button" onClick={() => discard(a.id)} className="text-sm text-slate-500 underline">
                {t("assistantPage.discard")}
              </button>
              {state.status === "error" && <span className="text-sm text-red-600">{state.message}</span>}
            </>
          )}
        </div>
      </div>
    );
  }

  const suggestions = [t("assistantPage.suggestion1"), t("assistantPage.suggestion2"), t("assistantPage.suggestion3"), t("assistantPage.suggestion4")];

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[60vh] min-h-[22rem] space-y-5 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <RobotMascot className="h-28 w-24" />
            <p className="max-w-md text-sm text-slate-600">{t("assistantPage.welcome")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-2 text-sm text-white">{m.text}</p>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <RobotMascot className="h-9 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`whitespace-pre-wrap text-sm ${m.error ? "text-red-600" : "text-slate-800"}`}>{m.text}</p>
                {m.artifacts?.map((a, j) => renderArtifact(a, `${i}-${j}`))}
              </div>
            </div>
          ),
        )}
        {pending && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <RobotMascot className="h-9 w-8 shrink-0" />
            {t("assistantPage.thinking")}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-3 border-t border-slate-200 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder={t("assistantPage.placeholder")}
          className="flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {t("assistantPage.send")}
        </button>
      </form>
    </div>
  );
}
