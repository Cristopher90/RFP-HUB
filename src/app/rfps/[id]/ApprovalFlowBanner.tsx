"use client";

import { Fragment, useEffect, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { ApprovalLevelView } from "@/lib/approvalEngine";

type PersonState = ApprovalLevelView["people"][number]["state"];

// "2d 3h 15m", "3h 15m 08s", "4m 08s": how long a step has been (or was) waiting.
function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h ${pad(m)}m`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}

// Counts up live from the moment the step became active.
function LiveTimer({ since }: { since: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return <>{now === null ? "…" : formatElapsed(now - new Date(since).getTime())}</>;
}

const NODE_TONE = {
  APPROVED: { box: "border-emerald-300 bg-emerald-50", dot: "bg-emerald-500 text-white", text: "text-emerald-700" },
  REJECTED: { box: "border-red-300 bg-red-50", dot: "bg-red-500 text-white", text: "text-red-700" },
  ACTIVE: { box: "border-amber-400 bg-amber-50 shadow-sm", dot: "bg-amber-500 text-white", text: "text-amber-800" },
  WAITING: { box: "border-slate-200 bg-slate-50", dot: "bg-slate-300 text-slate-600", text: "text-slate-500" },
} as const;

function Node({
  level,
  onSendReminder,
  reminderPending,
}: {
  level: ApprovalLevelView;
  onSendReminder?: (approvalId: string) => void;
  reminderPending: boolean;
}) {
  const { t } = usePreferences();
  const tone = NODE_TONE[level.status === "PENDING" ? (level.active ? "ACTIVE" : "WAITING") : level.status];
  const stateLabel: Record<PersonState, string> = {
    approved: t("approvalFlowBanner.stateApproved"),
    rejected: t("approvalFlowBanner.stateRejected"),
    pending: t("approvalFlowBanner.statePending"),
    waiting: t("approvalFlowBanner.stateWaiting"),
  };
  const nodeState: PersonState =
    level.status === "APPROVED" ? "approved" : level.status === "REJECTED" ? "rejected" : level.active ? "pending" : "waiting";
  const elapsed =
    level.pendingSince && level.decidedAt
      ? formatElapsed(new Date(level.decidedAt).getTime() - new Date(level.pendingSince).getTime())
      : null;

  return (
    <div
      className={`flex min-w-40 items-start gap-2.5 rounded-xl border px-3 py-2 ${tone.box}`}
      title={level.workflowName ?? undefined}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone.dot}`}>
        {level.order + 1}
      </span>
      <div className="min-w-0">
        {level.people.length === 0 ? (
          <p className="text-xs text-slate-400">{t("approvalFlowBanner.noneConfigured")}</p>
        ) : (
          level.people.map((p) => (
            <p key={`${p.id}-${p.state}`} className="truncate text-sm font-medium text-slate-800">
              {p.name}
            </p>
          ))
        )}
        <p className={`text-xs font-medium ${tone.text}`}>
          {stateLabel[nodeState]}
          {level.status === "PENDING" && level.active && level.pendingSince && (
            <>
              {" · "}
              <LiveTimer since={level.pendingSince} />
            </>
          )}
          {elapsed && ` · ${elapsed}`}
        </p>
        {level.status === "REJECTED" && level.rejectedReason && (
          <p className="mt-0.5 text-[11px] text-red-600">
            {t("approvalFlowBanner.reason")}: {level.rejectedReason}
          </p>
        )}
        {level.status === "PENDING" && level.active && onSendReminder && (
          <button
            type="button"
            disabled={reminderPending}
            onClick={() => onSendReminder(level.id)}
            className="mt-0.5 text-[11px] font-medium text-violet-600 hover:text-violet-700 disabled:opacity-60"
          >
            {t("approvalFlowBanner.sendReminder")}
          </button>
        )}
      </div>
    </div>
  );
}

// The approval flow of one stage (publish or award) as a single line of numbered
// steps, even when several processes apply: each step shows who takes part and
// where it stands, with a live clock on the step that is waiting (and how long
// each finished step took). Aprobar/Rechazar render below for qualifying users
// on the active step; Rechazar requires a reason.
export function ApprovalFlowBanner({
  title,
  levels,
  canDecide,
  onApprove,
  onReject,
  onSendReminder,
  pending,
}: {
  title: string;
  levels: ApprovalLevelView[];
  canDecide: boolean;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onSendReminder?: (approvalId: string) => void;
  pending: boolean;
}) {
  const { t } = usePreferences();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");

  if (levels.length === 0) return null;
  const rejectedLevel = levels.find((l) => l.status === "REJECTED");
  const activeLevel = levels.find((l) => l.active);

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">{title}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {levels.map((level, i) => (
          <Fragment key={level.id}>
            {i > 0 && (
              <span className="text-slate-300" aria-hidden>
                →
              </span>
            )}
            <Node level={level} onSendReminder={onSendReminder} reminderPending={pending} />
          </Fragment>
        ))}
      </div>

      {rejectedLevel && (
        <p className="mt-3 text-xs text-red-600">
          {t("approvalFlowBanner.rejectedByPrefix")} {t("approvalFlowBanner.step").toLowerCase()} {rejectedLevel.order + 1}: {rejectedLevel.rejectedReason}
        </p>
      )}

      {canDecide && activeLevel && onApprove && onReject && (
        <div className="mt-4">
          {!showRejectForm ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={pending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {t("approvalFlowBanner.reject")}
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={pending}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {t("approvalFlowBanner.approve")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("approvalFlowBanner.rejectionReasonPlaceholder")}
                className="w-64 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="button"
                disabled={pending || !reason.trim()}
                onClick={() => {
                  onReject(reason);
                  setShowRejectForm(false);
                  setReason("");
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {t("approvalFlowBanner.confirmRejection")}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                {t("approvalFlowBanner.cancel")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
