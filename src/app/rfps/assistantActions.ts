"use server";

import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/getDictionary";
import { assistantAccess } from "@/lib/assistant/access";
import { runAssistant, type ChatTurn } from "@/lib/assistant/run";
import type { Artifact } from "@/lib/assistant/tools";
import type { FormSnapshot } from "@/lib/assistant/formChanges";

export type AskFormResult = { reply: string; artifacts: Artifact[] } | { error: string };

const cut = (value: unknown, max: number) => String(value ?? "").slice(0, max);

// What goes to the model: the form's text fields, capped. Supplier e-mails and
// phone numbers are left out on purpose.
function shapeSnapshot(s: FormSnapshot): string {
  const shaped = {
    title: cut(s.title, 300),
    description: cut(s.description, 2000),
    internalNotes: cut(s.internalNotes, 1000),
    buyerName: cut(s.buyerName, 120),
    deadlineAt: cut(s.deadlineAt, 40),
    startDate: cut(s.startDate, 40),
    commodity: cut(s.commodity, 200),
    region: cut(s.region, 200),
    origin: cut(s.origin, 200),
    estimatedPrice: cut(s.estimatedPrice, 40),
    items: (s.items ?? []).slice(0, 80).map((i) => ({
      name: cut(i.name, 200), code: i.code ? cut(i.code, 40) : null, quantity: Number(i.quantity) || 0, unit: cut(i.unit, 30),
      historicalPrice: i.historicalPrice === null || i.historicalPrice === undefined ? null : Number(i.historicalPrice),
      description: cut(i.description, 300),
    })),
    questions: (s.questions ?? []).slice(0, 60).map((q) => ({
      text: cut(q.text, 300), type: cut(q.type, 20), options: (q.options ?? []).slice(0, 12).map((o) => cut(o, 80)), required: Boolean(q.required),
      audience: q.audience === "internal" ? "internal" : "supplier",
    })),
    suppliers: (s.suppliers ?? []).slice(0, 50).map((p) => ({ name: cut(p.name, 120), company: cut(p.company, 120) })),
  };
  return JSON.stringify(shaped).slice(0, 16000);
}

export async function askRfpAssistant(history: ChatTurn[], snapshot: FormSnapshot): Promise<AskFormResult> {
  const user = await requireUser();
  const d = getDictionary(user.language).assistantPage.errors;
  const access = await assistantAccess(user);
  if (!access) return { error: d.noAccess };

  const result = await runAssistant({
    ctx: {
      user: { id: user.id, name: user.name, lastName: user.lastName, role: user.role, clientId: user.clientId as string, timezone: user.timezone, language: user.language },
      client: { id: access.client.id, currency: access.client.currency },
      artifacts: [],
      form: { snapshot: shapeSnapshot(snapshot) },
    },
    clientName: access.client.description,
    provider: access.provider,
    model: access.model,
    encryptedKey: access.encryptedKey,
    history: history.slice(-20).map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", text: String(t.text ?? "").slice(0, 4000) })),
  });
  if ("reply" in result) return result;
  const messages: Record<string, string> = { rate: d.rate, auth: d.auth, refused: d.refused, tooLong: d.tooLong, api: d.generic };
  return { error: messages[result.code] ?? d.generic };
}
