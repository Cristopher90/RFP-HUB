import "server-only";
import { prisma } from "@/lib/prisma";
import { appUrl, defer, sendEmail } from "@/lib/mailer";
import { renderTemplate, resolveTemplate } from "@/lib/emailTemplates";
import type { EmailKind } from "@/lib/emailKinds";
import type { SupplierLinkStatus } from "@/generated/prisma/enums";

// Supplier contacts: a person has ONE portal account (unique email) and is
// connected to each client's supplier-directory entry through a
// SupplierUserLink. Lifecycle of a link:
//   PENDING_APPROVAL  the supplier already has an administrator, who must
//                     approve a contact added by the client
//   SENT              invitation emailed; waiting for the person to accept
//   ACCEPTED          connected — only then can they be chosen in an RFP and
//                     see that client's RFPs

type LinkWithRefs = {
  id: string;
  clientId: string;
  supplierDirectoryId: string;
  inviteToken: string;
  supplierUser: { id: string; name: string; email: string; language: string; passwordHash: string | null };
  supplierDirectory: { companyName: string };
  client: { description: string };
};

async function loadLink(linkId: string): Promise<LinkWithRefs | null> {
  return prisma.supplierUserLink.findUnique({
    where: { id: linkId },
    include: { supplierUser: true, supplierDirectory: true, client: true },
  });
}

async function send(
  kind: EmailKind,
  clientId: string,
  to: { email: string; language: string },
  vars: Record<string, string>,
  ctaPath: string,
): Promise<void> {
  const template = await resolveTemplate(clientId, kind, to.language);
  const rendered = renderTemplate(template, vars);
  await sendEmail(
    to.email,
    rendered.subject,
    {
      heading: rendered.heading,
      paragraphs: rendered.paragraphs,
      ctaLabel: rendered.cta,
      ctaUrl: appUrl(ctaPath),
    },
    { kind, clientId },
  );
}

// Emails the person the invitation to accept. A brand-new account gets the
// "join RFP HUB" email (they set their password on accepting); someone who
// already has an account gets the "accept a connection with this client" one.
async function sendInvitationNow(linkId: string, fallbackLanguage: string): Promise<void> {
  try {
    const link = await loadLink(linkId);
    if (!link) return;
    const person = link.supplierUser;
    const kind: EmailKind = person.passwordHash ? "supplierClientAccess" : "supplierInvite";
    await send(
      kind,
      link.clientId,
      { email: person.email, language: person.passwordHash ? person.language : fallbackLanguage },
      { name: person.name, client: link.client.description, company: link.supplierDirectory.companyName },
      `/supplier/accept/${link.inviteToken}`,
    );
  } catch (error) {
    console.error("[supplier:invite]", linkId, error);
  }
}

export function sendInvitation(linkId: string, fallbackLanguage: string): void {
  defer(() => sendInvitationNow(linkId, fallbackLanguage));
}

async function sendApprovalRequestNow(linkId: string): Promise<void> {
  try {
    const link = await loadLink(linkId);
    if (!link) return;
    const admins = await prisma.supplierUserLink.findMany({
      where: {
        supplierDirectoryId: link.supplierDirectoryId,
        isAdmin: true,
        status: "ACCEPTED",
      },
      include: { supplierUser: true },
    });
    for (const admin of admins) {
      await send(
        "supplierContactApproval",
        link.clientId,
        { email: admin.supplierUser.email, language: admin.supplierUser.language },
        {
          client: link.client.description,
          company: link.supplierDirectory.companyName,
          contact: link.supplierUser.name,
          email: link.supplierUser.email,
          name: admin.supplierUser.name,
        },
        "/supplier/contacts",
      );
    }
  } catch (error) {
    console.error("[supplier:approval]", linkId, error);
  }
}

export type AddContactResult = { error: string } | { linkId: string; status: SupplierLinkStatus };

// Connects a person (by email) to a supplier's directory entry. `byAdmin` is
// true when the supplier's own administrator adds them (no approval needed —
// the administrator is the approver).
export async function addContact(options: {
  supplierDirectoryId: string;
  name: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  byAdmin: boolean;
  language: string; // language of whoever is adding, used for a brand-new account's email
  duplicateError: string;
}): Promise<AddContactResult> {
  const email = options.email.trim().toLowerCase();
  const directory = await prisma.supplierDirectory.findUnique({
    where: { id: options.supplierDirectoryId },
  });
  if (!directory) return { error: options.duplicateError };

  let person = await prisma.supplierUser.findUnique({ where: { email } });
  if (!person) {
    person = await prisma.supplierUser.create({
      data: {
        name: options.name.trim(),
        lastName: options.lastName.trim(),
        email,
        language: options.language,
      },
    });
  }
  const existing = await prisma.supplierUserLink.findUnique({
    where: {
      supplierUserId_supplierDirectoryId: {
        supplierUserId: person.id,
        supplierDirectoryId: directory.id,
      },
    },
  });
  if (existing) return { error: options.duplicateError };

  const adminCount = await prisma.supplierUserLink.count({
    where: { supplierDirectoryId: directory.id, isAdmin: true, status: "ACCEPTED" },
  });
  const needsApproval = !options.byAdmin && adminCount > 0;
  const link = await prisma.supplierUserLink.create({
    data: {
      clientId: directory.clientId,
      supplierUserId: person.id,
      supplierDirectoryId: directory.id,
      isAdmin: options.isAdmin,
      status: needsApproval ? "PENDING_APPROVAL" : "SENT",
    },
  });
  if (needsApproval) defer(() => sendApprovalRequestNow(link.id));
  else sendInvitation(link.id, options.language);
  return { linkId: link.id, status: link.status };
}

// Removes a connection; the account itself goes too once it has none left.
export async function removeLink(linkId: string): Promise<void> {
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link) return;
  await prisma.supplierUserLink.delete({ where: { id: linkId } });
  const remaining = await prisma.supplierUserLink.count({
    where: { supplierUserId: link.supplierUserId },
  });
  if (remaining === 0) {
    await prisma.supplierUser.delete({ where: { id: link.supplierUserId } });
  }
}

// The supplier administrator approved a contact: now it gets the invitation.
export async function approveLink(linkId: string, language: string): Promise<void> {
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link || link.status !== "PENDING_APPROVAL") return;
  await prisma.supplierUserLink.update({ where: { id: linkId }, data: { status: "SENT" } });
  sendInvitation(linkId, language);
}

export async function acceptLink(linkId: string): Promise<void> {
  await prisma.supplierUserLink.update({
    where: { id: linkId },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
}

// Which of these RFP contacts are NOT an accepted portal contact of the
// directory entry they were picked from. An RFP can only invite accepted ones.
export async function findUnacceptedContacts(
  items: { email: string; supplierDirectoryId?: string | null }[],
): Promise<string[]> {
  const fromDirectory = items.filter((i) => i.supplierDirectoryId && i.email.trim());
  if (fromDirectory.length === 0) return [];
  const accepted = await prisma.supplierUserLink.findMany({
    where: {
      status: "ACCEPTED",
      supplierDirectoryId: { in: [...new Set(fromDirectory.map((i) => i.supplierDirectoryId!))] },
    },
    include: { supplierUser: { select: { email: true } } },
  });
  const ok = new Set(accepted.map((l) => `${l.supplierDirectoryId}|${l.supplierUser.email.toLowerCase()}`));
  return fromDirectory
    .filter((i) => !ok.has(`${i.supplierDirectoryId}|${i.email.trim().toLowerCase()}`))
    .map((i) => i.email.trim());
}
