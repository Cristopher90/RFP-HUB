import "server-only";
import { prisma } from "@/lib/prisma";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime, formatRfpNumber } from "@/lib/format";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { appUrl, defer, sendEmail } from "@/lib/mailer";
import { renderTemplate, resolveTemplate } from "@/lib/emailTemplates";
import type { EmailKind } from "@/lib/emailKinds";

// Email notifications for the RFP lifecycle. Texts come from the client's
// editable templates (see emailTemplates.ts) and every attempt is recorded in
// EmailLog by sendEmail. Every public function here is non-blocking (it runs
// after the response, via defer) and swallows its own errors — a failed email
// must never fail, or slow down, the action that triggered it.

export type MailRecipient = { email: string; language: string; timeZone: string };

type RfpRef = {
  id: string;
  clientId: string;
  number: number;
  title: string;
  buyerName?: string;
  deadlineAt?: Date | null;
  startDate?: Date | null;
};

function when(date: Date, recipient: MailRecipient): string {
  return formatDateTime(date, {
    locale: localeForLanguage(recipient.language),
    timeZone: recipient.timeZone,
  });
}

// Renders the client's template for `kind` and sends it. `extra` supplies the
// kind-specific placeholders (reason, supplier, counts, ...); anything not
// provided is an empty string, which makes lines that use it disappear.
async function deliver(options: {
  kind: EmailKind;
  rfp: RfpRef;
  recipient: MailRecipient;
  ctaPath: string;
  extra?: Record<string, string>;
  showStartDate?: boolean;
}): Promise<boolean> {
  const { kind, rfp, recipient, ctaPath, extra, showStartDate } = options;
  const template = await resolveTemplate(rfp.clientId, kind, recipient.language);
  const vars: Record<string, string> = {
    rfp: `${formatRfpNumber(rfp.number)} — ${rfp.title}`,
    title: rfp.title,
    number: formatRfpNumber(rfp.number),
    buyer: rfp.buyerName ?? "",
    deadline: rfp.deadlineAt ? when(rfp.deadlineAt, recipient) : "",
    startDate: showStartDate && rfp.startDate ? when(rfp.startDate, recipient) : "",
    reason: "",
    supplier: "",
    responses: "",
    invited: "",
    ...extra,
  };
  const rendered = renderTemplate(template, vars);
  return sendEmail(
    recipient.email,
    rendered.subject,
    {
      heading: rendered.heading,
      paragraphs: rendered.paragraphs,
      ctaLabel: rendered.cta,
      ctaUrl: appUrl(ctaPath),
    },
    { kind, clientId: rfp.clientId, rfpId: rfp.id },
  );
}

export async function sendApprovalRequestEmail(
  recipient: MailRecipient,
  rfp: RfpRef,
  stage: "PUBLISH" | "AWARD",
): Promise<void> {
  await deliver({
    kind: stage === "PUBLISH" ? "approvalPublish" : "approvalAward",
    rfp,
    recipient,
    ctaPath: stage === "AWARD" ? `/rfps/${rfp.id}/compare` : `/rfps/${rfp.id}`,
  });
}

export type StatusEmailKind =
  | "published"
  | "publishRejected"
  | "closed"
  | "reopened"
  | "awardPending"
  | "awarded"
  | "awardRejected"
  | "awardRevoked";

async function notifyCreatorOfStatusChangeNow(
  rfpId: string,
  kind: StatusEmailKind,
  options: { actorUserId?: string; reason?: string },
): Promise<void> {
  try {
    const rfp = await prisma.rfp.findUnique({
      where: { id: rfpId },
      include: {
        createdBy: true,
        invitations: { include: { response: true, supplier: true } },
      },
    });
    const creator = rfp?.createdBy;
    if (!rfp || !creator) return;
    // The creator made this change themselves — nothing to tell them.
    if (options.actorUserId && options.actorUserId === creator.id) return;

    const recipient = { email: creator.email, language: creator.language, timeZone: creator.timezone };
    const awarded = rfp.invitations.find((i) => i.id === rfp.awardedInvitationId);
    const awaitingStart =
      kind === "published" && rfp.status === "AWAITING_START" && Boolean(rfp.startDate);
    await deliver({
      kind: awaitingStart ? "awaitingStart" : kind,
      rfp,
      recipient,
      ctaPath: kind.startsWith("award") ? `/rfps/${rfp.id}/compare` : `/rfps/${rfp.id}`,
      showStartDate: awaitingStart,
      extra: {
        reason: options.reason ?? "—",
        supplier: awarded?.supplier.company || awarded?.supplier.name || "—",
        responses: String(rfp.invitations.filter((i) => i.response).length),
        invited: String(rfp.invitations.length),
      },
    });
  } catch (error) {
    console.error("[notify:status]", rfpId, kind, error);
  }
}

// Emails every invitation of a published RFP that hasn't been emailed yet.
// Idempotent: `notifiedAt` is only stamped once a message actually went
// out, so calling it from several publish paths never double-sends.
async function sendPendingInvitationsNow(rfpId: string): Promise<void> {
  try {
    const rfp = await prisma.rfp.findUnique({
      where: { id: rfpId },
      include: {
        invitations: { where: { notifiedAt: null, response: null }, include: { supplier: true } },
      },
    });
    if (!rfp || (rfp.status !== "OPEN" && rfp.status !== "AWAITING_START")) return;

    for (const invitation of rfp.invitations) {
      const email = invitation.supplier.email.trim();
      if (!email) continue;
      const portalUser = await prisma.supplierUser.findUnique({ where: { email: email.toLowerCase() } });
      const recipient: MailRecipient = {
        email,
        language: portalUser?.language ?? DEFAULT_PREFERENCES.language,
        timeZone: portalUser?.timezone ?? DEFAULT_PREFERENCES.timeZone,
      };
      const sent = await deliver({
        kind: "invitation",
        rfp,
        recipient,
        ctaPath: `/respond/${invitation.token}`,
        showStartDate: rfp.status === "AWAITING_START",
      });
      if (sent) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { notifiedAt: new Date() },
        });
      }
    }
  } catch (error) {
    console.error("[notify:invitations]", rfpId, error);
  }
}

// Tells the creator a supplier answered — except on blind RFPs
// (hideResponsesUntilClosed) still OPEN, where the buyer isn't meant to know
// anything about responses until the RFP closes.
async function notifySupplierRespondedNow(
  rfpId: string,
  invitationId: string,
): Promise<void> {
  try {
    const rfp = await prisma.rfp.findUnique({
      where: { id: rfpId },
      include: {
        createdBy: true,
        invitations: { include: { response: true, supplier: true } },
      },
    });
    const creator = rfp?.createdBy;
    if (!rfp || !creator) return;
    if (rfp.hideResponsesUntilClosed && rfp.status === "OPEN") return;

    const invitation = rfp.invitations.find((i) => i.id === invitationId);
    await deliver({
      kind: "supplierResponded",
      rfp,
      recipient: { email: creator.email, language: creator.language, timeZone: creator.timezone },
      ctaPath: `/rfps/${rfp.id}/compare`,
      extra: {
        supplier: invitation ? invitation.supplier.company || invitation.supplier.name : "—",
        responses: String(rfp.invitations.filter((i) => i.response).length),
        invited: String(rfp.invitations.length),
      },
    });
  } catch (error) {
    console.error("[notify:response]", rfpId, error);
  }
}

export async function notifyCreatorOfStatusChange(
  rfpId: string,
  kind: StatusEmailKind,
  options: { actorUserId?: string; reason?: string } = {},
): Promise<void> {
  defer(() => notifyCreatorOfStatusChangeNow(rfpId, kind, options));
}

export async function sendPendingInvitations(rfpId: string): Promise<void> {
  defer(() => sendPendingInvitationsNow(rfpId));
}

export async function notifySupplierResponded(
  rfpId: string,
  invitationId: string,
): Promise<void> {
  defer(() => notifySupplierRespondedNow(rfpId, invitationId));
}
