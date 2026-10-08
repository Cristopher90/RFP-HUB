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
  supplierDirectoryId: string;
  name: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
};

// The supplier's own administrator adds a contact: no approval step (they are
// the approver), the invitation goes out straight away.
export async function addSupplierContact(input: NewContactInput): Promise<Result> {
  const { supplierUser, ids, dictionary } = await administeredDirectoryIds();
  if (!ids.includes(input.supplierDirectoryId)) {
    return { error: dictionary.supplierContactsPage.notAvailable };
  }
  if (!input.name.trim() || !input.email.trim()) {
    return { error: dictionary.supplierContactsPage.nameAndEmailRequired };
  }
  const email = input.email.trim().toLowerCase();
  const result = await addContact({
    supplierDirectoryId: input.supplierDirectoryId,
    name: input.name,
    lastName: input.lastName,
    email,
    isAdmin: input.isAdmin,
    byAdmin: true,
    language: supplierUser.language,
    duplicateError: dictionary.supplierContactsPage.alreadyLinked.replace("{email}", email),
  });
  if ("error" in result) return result;
  revalidatePath("/supplier/contacts");
  return { success: true };
}

export async function removeSupplierContact(linkId: string): Promise<Result> {
  const { supplierUser, ids, dictionary } = await administeredDirectoryIds();
  const link = await prisma.supplierUserLink.findUnique({ where: { id: linkId } });
  if (!link || !ids.includes(link.supplierDirectoryId)) {
    return { error: dictionary.supplierContactsPage.notAvailable };
  }
  if (link.supplierUserId === supplierUser.id) {
    return { error: dictionary.supplierContactsPage.cannotRemoveSelf };
  }
  await removeLink(link.id);
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
