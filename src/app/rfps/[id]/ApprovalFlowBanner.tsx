"use client";

import { Fragment, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { ApprovalLevelView } from "@/lib/approvalEngine";

type PersonState = ApprovalLevelView["people"][number]["state"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const AVATAR: Record<PersonState, string> = {
  approved: "bg-emerald-500 text-white",
  rejected: "bg-red-500 text-white",
  pending: "bg-amber-400 text-amber-950 ring-2 ring-amber-200",
  waiting: "bg-slate-200 text-slate-500",
};

function stepTone(level: ApprovalLevelView) {
  if (level.status === "REJECTED") return { card: "border-red-300 bg-red-50", dot: "bg-red-500 text-white" };
  if (level.status === "APPROVED") return { card: "border-emerald-300 bg-emerald-50", dot: "bg-emerald-500 text-white" };
  if (level.active) return { card: "border-amber-400 bg-amber-50 shadow-sm", dot: "bg-amber-500 text-white" };
  return { card: "border-slate-200 bg-slate-50", dot: "bg-slate-300 text-slate-600" };
}

function StepCard({
  level,
  mine,
  onSendReminder,
  reminderPending,
}: {
  level: ApprovalLevelView;
  mine: boolean;
  onSendReminder?: (approvalId: string) => void;
  reminderPending: boolean;
}) {
  const { t, formatDateTime, formatCurrency } = usePreferences();
  const tone = stepTone(level);
  const kindLabel =
    level.kind === "group"
      ? (level.groupName ?? t("approvalFlowBanner.kindGroup"))
      : level.kind === "superior"
        ? t("approvalFlowBanner.kindSuperior")
        : t("approvalFlowBanner.kindUsers");
  const stateLabel: Record<PersonState, string> = {
    approved: t("approvalFlowBanner.stateApproved"),
    rejected: t("approvalFlowBanner.stateRejected"),
    pending: t("approvalFlowBanner.statePending"),
    waiting: t("approvalFlowBanner.stateWaiting"),
  };

  return (
    <div className={`w-60 shrink-0 rounded-xl border p-3 ${tone.card}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone.dot}`}>
          {level.status === "APPROVED" ? "✓" : level.status === "REJECTED" ? "✕" : level.order + 1}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-800">
            {t("approvalFlowBanner.step")} {level.order + 1} · {kindLabel}
          </p>
          {level.kind === "group" && (
            <p className="text-[11px] text-slate-500">
              {t("approvalFlowBanner.upTo")} {formatCurrency(level.requiredValue)}
            </p>
          )}
        </div>
        {mine && level.active && (
          <span className="ml-auto shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            {t("approvalFlowBanner.yourTurn")}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {level.people.length === 0 && (
          <li className="text-xs text-slate-400">{t("approvalFlowBanner.noneConfigured")}</li>
        )}
        {level.people.map((p) => (
          <li key={`${p.id}-${p.state}`} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${AVATAR[p.state]}`}
              title={stateLabel[p.state]}
            >
              {initials(p.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-800">{p.name}</span>
              <span className="block text-[11px] text-slate-500">
                {stateLabel[p.state]}
                {p.limit !== null && ` · ${t("approvalFlowBanner.upTo")} ${formatCurrency(p.limit)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {level.status === "REJECTED" && level.rejectedReason && (
        <p className="mt-2 text-[11px] text-red-600">
          {t("approvalFlowBanner.reason")}: {level.rejectedReason}
        </p>
      )}
      {level.status === "PENDING" && level.active && (
        <div className="mt-3 border-t border-amber-200 pt-2">
          {level.pendingSince && (
            <p className="text-[11px] text-amber-800">
              {t("approvalFlowBanner.pendingSince")} {formatDateTime(level.pendingSince)}
            </p>
          )}
          {onSendReminder && (
            <button
              type="button"
              disabled={reminderPending}
              onClick={() => onSendReminder(level.id)}
              className="mt-1 text-[11px] font-medium text-violet-600 hover:text-violet-700 disabled:opacity-60"
            >
              {t("approvalFlowBanner.sendReminder")}
            </button>
          )}
          {level.lastReminderAt && (
            <p className="text-[11px] text-slate-400">
              {t("approvalFlowBanner.lastReminder")}: {formatDateTime(level.lastReminderAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Draws the approval flow of one stage (publish or award) as a chain of step
// cards, grouped by process: each step lists the people who take part with
// their state (approved, must decide, waiting), so everyone who enters the flow
// is visible from the moment it starts. Aprobar/Rechazar render below for
// qualifying users on the active step; Rechazar requires a reason.
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

  // Consecutive steps of the same process share a lane.
  const lanes: { name: string | null; levels: ApprovalLevelView[] }[] = [];
  for (const level of levels) {
    const last = lanes[lanes.length - 1];
    if (last && last.name === level.workflowName) last.levels.push(level);
    else lanes.push({ name: level.workflowName, levels: [level] });
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">{title}</p>

      <div className="mt-3 space-y-4">
        {lanes.map((lane, li) => (
          <div key={`${lane.name}-${li}`}>
            {lane.name && (
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {t("approvalFlowBanner.process")}: {lane.name}
              </p>
            )}
            <div className="flex flex-wrap items-stretch gap-2">
              {lane.levels.map((level, i) => (
                <Fragment key={level.id}>
                  {i > 0 && (
                    <span className="flex items-center text-slate-300" aria-hidden>
                      →
                    </span>
                  )}
                  <StepCard
                    level={level}
                    mine={canDecide}
                    onSendReminder={onSendReminder}
                    reminderPending={pending}
                  />
                </Fragment>
              ))}
            </div>
          </div>
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
