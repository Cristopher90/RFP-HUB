"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/getDictionary";
import { assistantAccess } from "@/lib/assistant/access";
import { runAssistant, type ChatTurn } from "@/lib/assistant/run";
import { createDraftFromProposal, type Artifact, type ToolContext } from "@/lib/assistant/tools";

export type AskResult = { reply: string; artifacts: Artifact[] } | { error: string };

function toolUser(user: Awaited<ReturnType<typeof requireUser>>): ToolContext["user"] {
  return { id: user.id, name: user.name, lastName: user.lastName, role: user.role, clientId: user.clientId as string, timezone: user.timezone, language: user.language };
}

export async function askAssistant(history: ChatTurn[]): Promise<AskResult> {
  const user = await requireUser();
  const d = getDictionary(user.language).assistantPage.errors;
  const access = await assistantAccess(user);
  if (!access) return { error: d.noAccess };

  const result = await runAssistant({
    ctx: { user: toolUser(user), client: { id: access.client.id, currency: access.client.currency }, artifacts: [] },
    clientName: access.client.description,
    model: access.model,
    encryptedKey: access.encryptedKey,
    history: history.slice(-30).map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", text: String(t.text ?? "").slice(0, 8000) })),
  });
  if ("reply" in result) return result;
  const messages: Record<string, string> = { rate: d.rate, auth: d.auth, refused: d.refused, tooLong: d.tooLong, api: d.generic };
  return { error: messages[result.code] ?? d.generic };
}

export async function confirmProposal(proposalId: string): Promise<{ error: string } | { success: true; rfpId: string; number: number }> {
  const user = await requireUser();
  const d = getDictionary(user.language).assistantPage.errors;
  if (!user.clientId || !(await assistantAccess(user))) return { error: d.noAccess };
  const result = await createDraftFromProposal(proposalId, toolUser(user));
  if ("error" in result) return { error: result.error === "expired" ? d.expired : result.error === "already_done" ? d.alreadyDone : d.notFound };
  return { success: true, rfpId: result.rfpId, number: result.number };
}

export async function discardProposal(proposalId: string): Promise<{ success: true }> {
  const user = await requireUser();
  await prisma.assistantProposal.updateMany({ where: { id: proposalId, userId: user.id, status: "PENDING" }, data: { status: "DISCARDED" } });
  return { success: true };
}
