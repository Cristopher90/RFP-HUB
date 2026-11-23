// Who may revoke ("desadjudicar") an award from the monitor. Super
// Administrador and Administrador de cliente can always; everyone else needs
// the per-user permission.
export function canRevokeAward(user: { role: string; canRevokeAward?: boolean }): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN" || Boolean(user.canRevokeAward);
}

type AwardRfp = { status: string; hideResponsesUntilClosed: boolean };

// A manually closed RFP is locked: no new awards and no revoking (reopen it to
// change either). The one exception is awarding a blind-offer RFP, whose
// responses only become visible once it is closed.
export function awardingLocked(rfp: AwardRfp): boolean {
  return rfp.status === "CLOSED" && !rfp.hideResponsesUntilClosed;
}

export function revokingLocked(rfp: AwardRfp): boolean {
  return rfp.status === "CLOSED";
}
