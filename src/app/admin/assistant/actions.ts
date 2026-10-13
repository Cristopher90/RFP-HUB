"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";
import { ASSISTANT_MODELS } from "@/lib/assistant/access";

// Per-client AI assistant settings: on/off, model and the client's own Anthropic API key.

type Resolved = { error: string } | { error?: undefined; clientId: string; d: ReturnType<typeof getDictionary>["assistantSettings"] };

async function resolveClient(targetClientId?: string): Promise<Resolved> {
  const scope = await requireClientScope();
  const d = getDictionary(scope.user.language).assistantSettings;
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") return { error: d.noPermission };
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { error: d.selectClient };
  return { clientId, d };
}

export async function saveAssistantSettings(
  input: { enabled: boolean; model: string; apiKey: string; removeKey: boolean },
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const resolved = await resolveClient(targetClientId);
  if (resolved.error !== undefined) return { error: resolved.error };
  const { clientId, d } = resolved;
  if (!ASSISTANT_MODELS.some((m) => m.id === input.model)) return { error: d.invalidModel };

  const apiKey = input.apiKey.trim();
  if (apiKey && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(apiKey)) return { error: d.invalidKeyFormat };
  const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { assistantApiKeyEnc: true } });
  const willHaveKey = Boolean(apiKey) || (Boolean(existing?.assistantApiKeyEnc) && !input.removeKey);
  if (input.enabled && !willHaveKey) return { error: d.keyRequired };

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        assistantEnabled: input.enabled && willHaveKey,
        assistantModel: input.model,
        ...(apiKey
          ? { assistantApiKeyEnc: encryptSecret(apiKey), assistantApiKeyLast4: apiKey.slice(-4) }
          : input.removeKey
            ? { assistantApiKeyEnc: null, assistantApiKeyLast4: null }
            : {}),
      },
    });
  } catch (error) {
    console.error("[assistant:settings]", error);
    return { error: d.saveFailed };
  }
  revalidatePath("/admin/assistant");
  revalidatePath("/", "layout");
  return { success: true };
}

// Makes one tiny request with the key (the typed one, or the saved one).
export async function testAssistantConnection(
  input: { apiKey: string; model: string },
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const resolved = await resolveClient(targetClientId);
  if (resolved.error !== undefined) return { error: resolved.error };
  const { clientId, d } = resolved;
  let key = input.apiKey.trim();
  if (!key) {
    const saved = await prisma.client.findUnique({ where: { id: clientId }, select: { assistantApiKeyEnc: true } });
    if (!saved?.assistantApiKeyEnc) return { error: d.keyRequired };
    key = decryptSecret(saved.assistantApiKeyEnc);
  }
  const model = ASSISTANT_MODELS.some((m) => m.id === input.model) ? input.model : "claude-opus-5-5";
  try {
    await new Anthropic({ apiKey: key, maxRetries: 0 }).messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: "Reply with: ok" }],
    });
    return { success: true };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { error: d.testAuthFailed };
    if (error instanceof Anthropic.PermissionDeniedError) return { error: d.testPermission };
    if (error instanceof Anthropic.NotFoundError) return { error: d.testModelNotFound };
    if (error instanceof Anthropic.RateLimitError) return { error: d.testRateLimited };
    return { error: `${d.testFailed} ${error instanceof Error ? error.message.slice(0, 160) : ""}`.trim() };
  }
}
