import "server-only";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime, formatRfpNumber } from "@/lib/format";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { appUrl, fill, sendEmail } from "@/lib/mailer";

// Email notifications for the RFP lifecycle. Every function here swallows
// its own errors (sendEmail never throws, and lookups are guarded) — a
// failed email must never fail the action that triggered it.

export type MailRecipient = { email: string; language: string; timeZone: string };

type RfpRef = { id: string; number: number; title: string };

function rfpLabel(rfp: RfpRef): string {
  return `${formatRfpNumber(rfp.number)} — ${rfp.title}`;
}

function when(date: Date, recipient: MailRecipient): string {
  return formatDateTime(date, {
    locale: localeForLanguage(recipient.language),
    timeZone: recipient.timeZone,
  });
}

export async function sendApprovalRequestEmail(
  recipient: MailRecipient,
  rfp: RfpRef,
  stage: "PUBLISH" | "AWARD",
): Promise<void> {
  const d = getDictionary(recipient.language).emails;
  const vars = { rfp: rfpLabel(rfp) };
  await sendEmail(recipient.email, fill(d.approval.subject, vars), {
    heading: d.approval.heading,
    paragraphs: [fill(stage === "PUBLISH" ? d.approval.publishBody : d.approval.awardBody, vars)],
    ctaLabel: d.approval.cta,
    ctaUrl: appUrl(stage === "AWARD" ? `/rfps/${rfp.id}/compare` : `/rfps/${rfp.id}`),
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

// Tells the RFP's creator that its status changed. Skipped when the creator
// is the one who made the change (they already know).
export async function notifyCreatorOfStatusChange(
  rfpId: string,
  kind: StatusEmailKind,
  options: { actorUserId?: string; reason?: string } = {},
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
    if (options.actorUserId && options.actorUserId === creator.id) return;

    const recipient = { email: creator.email, language: creator.language, timeZone: creator.timezone };
    const d = getDictionary(creator.language).emails;
    const awarded = rfp.invitations.find((i) => i.id === rfp.awardedInvitationId);
    const vars = {
      rfp: rfpLabel(rfp),
      reason: options.reason ?? "—",
      supplier: awarded?.supplier.company || awarded?.supplier.name || "—",
      responses: String(rfp.invitations.filter((i) => i.response).length),
      invited: String(rfp.invitations.length),
      date: rfp.startDate ? when(rfp.startDate, recipient) : "—",
    };
    const useAwaiting =
      kind === "published" && rfp.status === "AWAITING_START" && rfp.startDate;
    const template = useAwaiting ? d.status.awaitingStart : d.status[kind];
    await sendEmail(creator.email, fill(template.subject, vars), {
      heading: template.heading,
      paragraphs: [fill(template.body, vars)],
      ctaLabel: d.status.cta,
      ctaUrl: appUrl(kind.startsWith("award") ? `/rfps/${rfp.id}/compare` : `/rfps/${rfp.id}`),
    });
  } catch (error) {
    console.error("[notify:status]", rfpId, kind, error);
  }
}

// Emails every invitation of a published RFP that hasn't been emailed yet.
// Idempotent: `notifiedAt` is only stamped once a message actually went
// out, so calling it from several publish paths never double-sends.
export async function sendPendingInvitations(rfpId: string): Promise<void> {
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
      const d = getDictionary(recipient.language).emails.invitation;
      const vars = {
        rfp: rfpLabel(rfp),
        buyer: rfp.buyerName,
        date: when(rfp.deadlineAt, recipient),
      };
      const paragraphs = [fill(d.intro, vars), fill(d.deadline, vars)];
      if (rfp.status === "AWAITING_START" && rfp.startDate) {
        paragraphs.push(fill(d.startsAt, { date: when(rfp.startDate, recipient) }));
      }
      const sent = await sendEmail(email, fill(d.subject, vars), {
        heading: d.heading,
        paragraphs,
        ctaLabel: d.cta,
        ctaUrl: appUrl(`/respond/${invitation.token}`),
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
export async function notifySupplierResponded(
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
    const d = getDictionary(creator.language).emails.supplierResponded;
    const vars = {
      rfp: rfpLabel(rfp),
      supplier: invitation ? invitation.supplier.company || invitation.supplier.name : "—",
      responses: String(rfp.invitations.filter((i) => i.response).length),
      invited: String(rfp.invitations.length),
    };
    await sendEmail(creator.email, fill(d.subject, vars), {
      heading: d.heading,
      paragraphs: [fill(d.body, vars)],
      ctaLabel: d.cta,
      ctaUrl: appUrl(`/rfps/${rfp.id}/compare`),
    });
  } catch (error) {
    console.error("[notify:response]", rfpId, error);
  }
}
