// Every email the app can send, shared by the sender (notifications.ts), the
// per-client template editor and the email log. Client-safe: no server imports.
export const EMAIL_KINDS = [
  "invitation",
  "approvalPublish",
  "approvalAward",
  "published",
  "awaitingStart",
  "publishRejected",
  "closed",
  "reopened",
  "awardPending",
  "awarded",
  "awardRejected",
  "awardRevoked",
  "supplierResponded",
  "supplierInvite",
  "supplierClientAccess",
  "supplierContactApproval",
] as const;

export type EmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_LANGUAGES = ["es", "en"] as const;

// Placeholders each kind can use in its subject/heading/body/button text.
export const KIND_PLACEHOLDERS: Record<EmailKind, string[]> = {
  invitation: ["rfp", "title", "number", "buyer", "deadline", "startDate"],
  approvalPublish: ["rfp", "title", "number", "buyer", "deadline"],
  approvalAward: ["rfp", "title", "number", "buyer", "deadline"],
  published: ["rfp", "title", "number"],
  awaitingStart: ["rfp", "title", "number", "startDate"],
  publishRejected: ["rfp", "title", "number", "reason"],
  closed: ["rfp", "title", "number", "responses", "invited"],
  reopened: ["rfp", "title", "number"],
  awardPending: ["rfp", "title", "number"],
  awarded: ["rfp", "title", "number", "supplier"],
  awardRejected: ["rfp", "title", "number", "reason"],
  awardRevoked: ["rfp", "title", "number"],
  supplierResponded: ["rfp", "title", "number", "supplier", "responses", "invited"],
  supplierInvite: ["name", "client", "company"],
  supplierClientAccess: ["name", "client", "company"],
  supplierContactApproval: ["name", "contact", "email", "client", "company"],
};

export function isEmailKind(value: string): value is EmailKind {
  return (EMAIL_KINDS as readonly string[]).includes(value);
}
