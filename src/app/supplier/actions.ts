"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import { acceptedLinks, requireSupplierUser } from "@/lib/supplierAuth";
import {
  acceptLink,
  addContact,
  approveLink,
  removeLink,
  sendInvitation,
} from "@/lib/supplierContacts";

type Result = { error: string } | { success: true };

// The supplier directory entries the signed-in person administers.
async function administeredDirectoryIds() {
  const supplierUser = await requireSupplierUser();
  const ids = acceptedLinks(supplierUser)
    .filter((l) => l.isAdmin)
    .map((l) => l.supplierDirectoryId);
  return { supplierUser, ids, dictionary: getDictionary(supplierUser.language) };
}

// The person accepts a connection with a client that another client's
// invitation (or the same one, from inside the portal) is offering.
export async function acceptMyConnection(linkId: string): Promise<Result> {
  const supplierUser = await requireSupplierUser();
  const dictionary = getDictionary(supplierUser.language);
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link || link.supplierUserId !== supplierUser.id || link.status !== "SENT") {
    return { error: dictionary.supplierContactsPage.notAvailable };
  }
  await acceptLink(link.id);
  revalidatePath("/supplier", "layout");
  return { success: true };
}

export async function declineMyConnection(linkId: string): Promise<Result> {
  const supplierUser = await requireSupplierUser();
  const dictionary = getDictionary(supplierUser.language);
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link || link.supplierUserId !== supplierUser.id || link.status === "ACCEPTED") {
    return { error: dictionary.supplierContactsPage.notAvailable };
  }
  await removeLink(link.id);
  revalidatePath("/supplier", "layout");
  return { success: true };
}

export async function approveContact(linkId: string): Promise<Result> {
  const { supplierUser, ids, dictionary } = await administeredDirectoryIds();
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link || !ids.includes(link.supplierDirectoryId) || link.status !== "PENDING_APPROVAL") {
    return { error: dictionary.supplierContactsPage.notAvailable };
  }
  await approveLink(link.id, supplierUser.language);
  revalidatePath("/supplier/contacts");
  return { success: true };
}

export async function rejectContact(linkId: string): Promise<Result> {
  const { ids, dictionary } = await administeredDirectoryIds();
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link || !ids.includes(link.supplierDirectoryId) || link.status !== "PENDING_APPROVAL") {
    return { error: dictionary.supplierContactsPage.notAvailable };
  }
  await removeLink(link.id);
  revalidatePath("/supplier/contacts");
  return { success: true };
}

export type NewContactInput = {
  name: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  supplierDirectoryIds: string[]; // the clients (directory entries) they are assigned to
};

// The supplier's own administrator adds a contact and picks the clients they
// can take part in: no approval step (they are the approver), the invitation
// goes out straight away. If the email already has an account (e.g. from
// another client) that same account is connected to each chosen client.
export async function addSupplierContact(input: NewContactInput): Promise<Result> {
  const { supplierUser, ids, dictionary } = await administeredDirectoryIds();
  const chosen = [...new Set(input.supplierDirectoryIds)];
  if (chosen.length === 0 || chosen.some((id) => !ids.includes(id))) {
    return { error: dictionary.supplierContactsPage.pickAtLeastOneClient };
  }
  if (!input.name.trim() || !input.email.trim()) {
    return { error: dictionary.supplierContactsPage.nameAndEmailRequired };
  }
  const email = input.email.trim().toLowerCase();
  let created = 0;
  let lastError: string | null = null;
  for (const supplierDirectoryId of chosen) {
    const result = await addContact({
      supplierDirectoryId,
      name: input.name,
      lastName: input.lastName,
      email,
      isAdmin: input.isAdmin,
      byAdmin: true,
      language: supplierUser.language,
      duplicateError: dictionary.supplierContactsPage.alreadyLinked.replace("{email}", email),
    });
    if ("error" in result) lastError = result.error;
    else created += 1;
  }
  if (created === 0 && lastError) return { error: lastError };
  revalidatePath("/supplier/contacts");
  return { success: true };
}

export type ClientAssignment = { supplierDirectoryId: string; assigned: boolean; isAdmin: boolean };

// Sets which of the administrator's clients a contact is assigned to (and
// whether they administer each). Unticking a client removes the connection.
export async function saveContactClients(
  supplierUserId: string,
  assignments: ClientAssignment[],
): Promise<Result> {
  const { supplierUser, ids, dictionary } = await administeredDirectoryIds();
  if (supplierUserId === supplierUser.id) {
    return { error: dictionary.supplierContactsPage.cannotEditSelf };
  }
  const person = await prisma.supplierUser.findUnique({ where: { id: supplierUserId } });
  if (!person) return { error: dictionary.supplierContactsPage.notAvailable };

  for (const a of assignments) {
    if (!ids.includes(a.supplierDirectoryId)) {
      return { error: dictionary.supplierContactsPage.notAvailable };
    }
    const link = await prisma.supplierUserLink.findUnique({
      where: {
        supplierUserId_supplierDirectoryId: {
          supplierUserId,
          supplierDirectoryId: a.supplierDirectoryId,
        },
      },
    });
    if (a.assigned && !link) {
      const result = await addContact({
        supplierDirectoryId: a.supplierDirectoryId,
        name: person.name,
        lastName: person.lastName,
        email: person.email,
        isAdmin: a.isAdmin,
        byAdmin: true,
        language: supplierUser.language,
        duplicateError: dictionary.supplierContactsPage.alreadyLinked.replace("{email}", person.email),
      });
      if ("error" in result) return result;
    } else if (a.assigned && link) {
      if (link.isAdmin !== a.isAdmin) {
        await prisma.supplierUserLink.update({ where: { id: link.id }, data: { isAdmin: a.isAdmin } });
      }
    } else if (!a.assigned && link) {
      await removeLink(link.id);
    }
  }
  revalidatePath("/supplier/contacts");
  return { success: true };
}

// Removes a contact from every client of this company the administrator manages.
export async function removeSupplierContact(supplierUserId: string): Promise<Result> {
  const { supplierUser, ids, dictionary } = await administeredDirectoryIds();
  if (supplierUserId === supplierUser.id) {
    return { error: dictionary.supplierContactsPage.cannotRemoveSelf };
  }
  const links = await prisma.supplierUserLink.findMany({
    where: { supplierUserId, supplierDirectoryId: { in: ids } },
  });
  if (links.length === 0) return { error: dictionary.supplierContactsPage.notAvailable };
  for (const link of links) await removeLink(link.id);
  revalidatePath("/supplier/contacts");
  return { success: true };
}

export async function resendContactInvitation(linkId: string): Promise<Result> {
  const { supplierUser, ids, dictionary } = await administeredDirectoryIds();
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link || !ids.includes(link.supplierDirectoryId) || link.status !== "SENT") {
    return { error: dictionary.supplierContactsPage.notAvailable };
  }
  sendInvitation(link.id, supplierUser.language);
  return { success: true };
}
