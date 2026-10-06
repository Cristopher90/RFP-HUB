import "server-only";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import { fill } from "@/lib/mailer";
import type { EmailKind } from "@/lib/emailKinds";

export type EmailTemplateFields = {
  subject: string;
  heading: string;
  body: string;
  cta: string;
};

export function defaultTemplate(kind: EmailKind, language: string): EmailTemplateFields {
  return { ...getDictionary(language).emails[kind] };
}

// The text actually used for a client: its saved override for this
// kind+language, field by field falling back to the built-in default (so a
// blank field in an override never produces an empty email).
export async function resolveTemplate(
  clientId: string,
  kind: EmailKind,
  language: string,
): Promise<EmailTemplateFields> {
  const defaults = defaultTemplate(kind, language);
  const override = await prisma.emailTemplate.findUnique({
    where: { clientId_kind_language: { clientId, kind, language } },
  });
  if (!override) return defaults;
  return {
    subject: override.subject.trim() || defaults.subject,
    heading: override.heading.trim() || defaults.heading,
    body: override.body.trim() || defaults.body,
    cta: override.cta.trim() || defaults.cta,
  };
}

export type RenderedEmail = {
  subject: string;
  heading: string;
  paragraphs: string[];
  cta: string;
};

// Fills {placeholders}. In the body, each line is a paragraph, and a line
// that references a placeholder whose value is empty is dropped — that's how
// "La RFP abre el {startDate}..." disappears when the RFP has no start date.
export function renderTemplate(
  template: EmailTemplateFields,
  vars: Record<string, string>,
): RenderedEmail {
  const paragraphs = template.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      return keys.every((key) => vars[key] !== "");
    })
    .map((line) => fill(line, vars));
  return {
    subject: fill(template.subject, vars),
    heading: fill(template.heading, vars),
    paragraphs,
    cta: fill(template.cta, vars),
  };
}
