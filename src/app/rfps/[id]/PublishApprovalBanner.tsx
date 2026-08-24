"use client";

import { useTransition } from "react";
import { approvePublish, rejectPublish } from "./actions";

export function PublishApprovalBanner({
  rfpId,
  canDecide,
  requirementLabel,
}: {
  rfpId: string;
  canDecide: boolean;
  requirementLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-amber-800">
          Pendiente de aprobación para publicar
        </p>
        <p className="text-xs text-amber-700">{requirementLabel}</p>
      </div>
      {canDecide && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await rejectPublish(rfpId);
              })
            }
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            Rechazar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await approvePublish(rfpId);
              })
            }
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Aprobar publicación
          </button>
        </div>
      )}
    </div>
  );
}
