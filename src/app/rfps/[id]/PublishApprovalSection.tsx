"use client";

import { useTransition } from "react";
import type { ApprovalLevelView } from "@/lib/approvalEngine";
import { ApprovalFlowBanner } from "./ApprovalFlowBanner";
import { approvePublish, rejectPublish, sendApprovalReminder } from "./actions";
import { usePreferences } from "@/i18n/PreferencesProvider";

export function PublishApprovalSection({
  rfpId,
  levels,
  canDecide,
  awaiting,
}: {
  rfpId: string;
  levels: ApprovalLevelView[];
  canDecide: boolean;
  // true while the publish approval is still open; false once it is over (the flow stays visible).
  awaiting: boolean;
}) {
  const { t } = usePreferences();
  const [pending, startTransition] = useTransition();

  return (
    <ApprovalFlowBanner
      title={awaiting ? t("publishApprovalSection.title") : t("approvalFlowBanner.flowTitleDone")}
      levels={levels}
      canDecide={canDecide}
      pending={pending}
      onApprove={() => startTransition(async () => { await approvePublish(rfpId); })}
      onReject={(reason) =>
        startTransition(async () => {
          await rejectPublish(rfpId, reason);
        })
      }
      onSendReminder={(approvalId) =>
        startTransition(async () => {
          await sendApprovalReminder(rfpId, approvalId);
        })
      }
    />
  );
}
