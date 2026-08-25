"use client";

import { Fragment, useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { ApprovalLevelView } from "@/lib/approvalEngine";

function chipClass(level: ApprovalLevelView) {
  if (level.status === "REJECTED") return "border-red-300 bg-red-100 text-red-700";
  if (level.status === "APPROVED") return "border-emerald-300 bg-emerald-100 text-emerald-700";
  if (level.active) return "border-amber-400 bg-amber-100 text-amber-800";
  return "border-slate-300 bg-slate-100 text-slate-500";
}

function LevelPopover({
  level,
  onSendReminder,
  reminderPending,
}: {
  level: ApprovalLevelView;
  onSendReminder?: (approvalId: string) => void;
  reminderPending: boolean;
}) {
  return (
    <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
      {level.status === "REJECTED" && (
        <p className="text-xs text-red-600">Motivo: {level.rejectedReason}</p>
      )}
      {level.status === "APPROVED" && level.approverNames.length > 0 && (
        <p className="text-xs text-emerald-700">
          Aprobado por {level.approverNames.join(", ")}
        </p>
      )}
      {level.status === "PENDING" && !level.active && (
        <p className="text-xs text-slate-400">Este nivel aún no está activo.</p>
      )}
      {level.status === "PENDING" && level.active && level.pendingSince && (
        <p className="text-xs text-amber-700">
          Pendiente desde {formatDateTime(level.pendingSince)}
        </p>
      )}
      <div className="mt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Puede decidir
        </p>
        {level.eligibleApprovers.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">Nadie configurado.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {level.eligibleApprovers.map((a) => (
              <li key={a.id} className="text-xs text-slate-600">
                {a.name}
                {a.limit !== null && (
                  <span className="text-slate-400"> · hasta ${a.limit.toLocaleString()}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {level.status === "PENDING" && level.active && onSendReminder && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button
            type="button"
            disabled={reminderPending}
            onClick={() => onSendReminder(level.id)}
            className="text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-60"
          >
            Enviar recordatorio
          </button>
          {level.lastReminderAt && (
            <p className="mt-1 text-[11px] text-slate-400">
              Último recordatorio: {formatDateTime(level.lastReminderAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Renders the ordered chain of approval levels for one stage (publish or
// award): "Aprobador 1 → Aprobador 2", each chip colored by live status.
// Clicking a chip opens a popover with who's eligible to decide, since when
// it's pending, and a reminder action. Aprobar/Rechazar render below the
// chip row for qualifying users on the currently-active level; Rechazar
// requires a reason before it can be confirmed.
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
  onApprove: () => void;
  onReject: (reason: string) => void;
  onSendReminder?: (approvalId: string) => void;
  pending: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");
  const [openOrder, setOpenOrder] = useState<number | null>(null);

  if (levels.length === 0) return null;
  const rejectedLevel = levels.find((l) => l.status === "REJECTED");
  const activeLevel = levels.find((l) => l.active);

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {levels.map((level, i) => (
          <Fragment key={level.order}>
            {i > 0 && (
              <span className="text-slate-300" aria-hidden>
                →
              </span>
            )}
            <span className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenOrder((prev) => (prev === level.order ? null : level.order))
                }
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${chipClass(level)}`}
              >
                Aprobador {level.order + 1}: {level.label}
                {level.status === "APPROVED" && level.approverNames.length > 0 && (
                  <span className="opacity-80"> · {level.approverNames.join(", ")}</span>
                )}
              </button>
              {openOrder === level.order && (
                <LevelPopover
                  level={level}
                  onSendReminder={onSendReminder}
                  reminderPending={pending}
                />
              )}
            </span>
          </Fragment>
        ))}
      </div>

      {rejectedLevel && (
        <p className="mt-2 text-xs text-red-600">
          Rechazado por Aprobador {rejectedLevel.order + 1}: {rejectedLevel.rejectedReason}
        </p>
      )}

      {canDecide && activeLevel && (
        <div className="mt-3">
          {!showRejectForm ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={pending}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={pending}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Aprobar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo del rechazo (obligatorio)"
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
                Confirmar rechazo
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
