"use client";

import { Fragment, useState } from "react";
import type { ApprovalLevelView } from "@/lib/approvalEngine";

function chipClass(level: ApprovalLevelView) {
  if (level.status === "REJECTED") return "border-red-300 bg-red-100 text-red-700";
  if (level.status === "APPROVED") return "border-emerald-300 bg-emerald-100 text-emerald-700";
  if (level.active) return "border-amber-400 bg-amber-100 text-amber-800";
  return "border-slate-300 bg-slate-100 text-slate-500";
}

// Renders the ordered chain of approval levels for one stage (publish or
// award): "Aprobador 1 → Aprobador 2", each chip colored by live status,
// with Aprobar/Rechazar on the currently-active chip for qualifying users.
// Rechazar requires a reason before it can be confirmed.
export function ApprovalFlowBanner({
  title,
  levels,
  canDecide,
  onApprove,
  onReject,
  pending,
}: {
  title: string;
  levels: ApprovalLevelView[];
  canDecide: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  pending: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");

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
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${chipClass(level)}`}
            >
              Aprobador {level.order + 1}: {level.label}
              {level.status === "APPROVED" && level.approverNames.length > 0 && (
                <span className="opacity-80"> · {level.approverNames.join(", ")}</span>
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
