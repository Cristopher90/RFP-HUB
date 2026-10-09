"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSupplierSessionCookie } from "@/lib/supplierAuth";
import { getViewerPreferences } from "@/lib/preferences";
import { getDictionary } from "@/i18n/getDictionary";
import { acceptLink } from "@/lib/supplierContacts";

const MIN_PASSWORD_LENGTH = 8;

// Public (the person arrives from an email, not signed in). The invite token
// identifies the connection. A brand-new account sets its password here; an
// account that already has one confirms it, which also proves it's them.
export async function acceptInvitation(
  token: string,
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const dictionary = getDictionary((await getViewerPreferences()).language);
  const t = dictionary.supplierAccept;
  const password = (formData.get("password") as string | null) ?? "";
  const confirm = (formData.get("confirm") as string | null) ?? "";

  const link = await prisma.supplierUserLink.findUnique({
    where: { inviteToken: token },
    include: { supplierUser: true },
  });
  if (!link) return { error: t.invalid };
  if (link.status === "PENDING_APPROVAL") return { error: t.pendingApproval };

  const person = link.supplierUser;
  if (person.passwordHash) {
    if (!verifyPassword(password, person.passwordHash)) return { error: t.wrongPassword };
  } else {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: t.passwordTooShort.replace("{min}", String(MIN_PASSWORD_LENGTH)) };
    }
    if (password !== confirm) return { error: t.passwordMismatch };
    await prisma.supplierUser.update({
      where: { id: person.id },
      data: { passwordHash: hashPassword(password) },
    });
  }

  if (link.status === "SENT") await acceptLink(link.id);
  await createSupplierSessionCookie(person.id, "INVITATION");
  redirect("/supplier");
}
