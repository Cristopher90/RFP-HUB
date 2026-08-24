"use client";

import { useTransition } from "react";
import type { ApprovalLevelView } from "@/lib/approvalEngine";
import { ApprovalFlowBanner } from "./ApprovalFlowBanner";
import { approvePublish, rejectPublish } from "./actions";

export function PublishApprovalSection({
  rfpId,
  levels,
  canDecide,
}: {
  rfpId: string;
  levels: ApprovalLevelView[];
  canDecide: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <ApprovalFlowBanner
      title="Pendiente de aprobación para publicar"
      levels={levels}
      canDecide={canDecide}
      pending={pending}
      onApprove={() => startTransition(async () => { await approvePublish(rfpId); })}
      onReject={(reason) =>
        startTransition(async () => {
          await rejectPublish(rfpId, reason);
        })
      }
    />
  );
}
