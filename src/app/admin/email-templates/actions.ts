"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary, type Dictionary } from "@/i18n/getDictionary";
import { EMAIL_LANGUAGES, isEmailKind } from "@/lib/emailKinds";

export type EmailTemplateInput = {
  kind: string;
  language: string;
  subject: string;
  heading: string;
  body: string;
  cta: string;
};

// CLIENT_ADMIN edits their own client's templates; a Super Administrador
// picks the client explicitly (same rule as every other per-client screen).
async function requireTemplatesScope(
  targetClientId?: string,
): Promise<{ error: string } | { clientId: string; dictionary: Dictionary }> {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const dictionary = getDictionary(scope.user.language);
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) {
    return { error: dictionary.emailTemplatesActions.selectClient };
  }
  return { clientId, dictionary };
}

export async function saveEmailTemplate(
  input: EmailTemplateInput,
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const resolved = await requireTemplatesScope(targetClientId);
  if ("error" in resolved) return resolved;
  const { clientId, dictionary } = resolved;
  const d = dictionary.emailTemplatesActions;

  if (!isEmailKind(input.kind)) return { error: d.invalidKind };
  if (!(EMAIL_LANGUAGES as readonly string[]).includes(input.language)) {
    return { error: d.invalidLanguage };
  }
  const subject = input.subject.trim();
  const heading = input.heading.trim();
  const body = input.body.trim();
  if (!subject) return { error: d.subjectRequired };
  if (!heading) return { error: d.headingRequired };
  if (!body) return { error: d.bodyRequired };
  const cta = input.cta.trim();

  await prisma.emailTemplate.upsert({
    where: {
      clientId_kind_language: { clientId, kind: input.kind, language: input.language },
    },
    create: { clientId, kind: input.kind, language: input.language, subject, heading, body, cta },
    update: { subject, heading, body, cta },
  });
  revalidatePath("/admin/email-templates");
  return { success: true };
}

// Deleting the override makes that email fall back to the built-in text.
export async function resetEmailTemplate(
  kind: string,
  language: string,
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const resolved = await requireTemplatesScope(targetClientId);
  if ("error" in resolved) return resolved;
  const { clientId, dictionary } = resolved;
  if (!isEmailKind(kind)) return { error: dictionary.emailTemplatesActions.invalidKind };

  await prisma.emailTemplate.deleteMany({ where: { clientId, kind, language } });
  revalidatePath("/admin/email-templates");
  return { success: true };
}
