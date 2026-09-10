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
}: {
  rfpId: string;
  levels: ApprovalLevelView[];
  canDecide: boolean;
}) {
  const { t } = usePreferences();
  const [pending, startTransition] = useTransition();

  return (
    <ApprovalFlowBanner
      title={t("publishApprovalSection.title")}
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
