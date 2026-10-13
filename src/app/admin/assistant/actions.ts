"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";
import { ASSISTANT_MODELS, DEFAULT_MODEL, isProvider, type AssistantProvider } from "@/lib/assistant/access";
import { GeminiError, testGemini } from "@/lib/assistant/gemini";

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
  input: { provider: string; enabled: boolean; model: string; apiKey: string; removeKey: boolean },
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const resolved = await resolveClient(targetClientId);
  if (resolved.error !== undefined) return { error: resolved.error };
  const { clientId, d } = resolved;
  if (!isProvider(input.provider)) return { error: d.invalidProvider };
  const provider = input.provider;
  if (!ASSISTANT_MODELS[provider].some((m) => m.id === input.model)) return { error: d.invalidModel };

  const apiKey = input.apiKey.trim();
  if (apiKey && !validKeyFormat(provider, apiKey)) return { error: provider === "gemini" ? d.invalidKeyFormatGemini : d.invalidKeyFormat };
  const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { assistantApiKeyEnc: true, geminiApiKeyEnc: true } });
  const hasSaved = Boolean(provider === "gemini" ? existing?.geminiApiKeyEnc : existing?.assistantApiKeyEnc);
  const willHaveKey = Boolean(apiKey) || (hasSaved && !input.removeKey);
  if (input.enabled && !willHaveKey) return { error: d.keyRequired };

  const keyData = apiKey
    ? { enc: encryptSecret(apiKey), last4: apiKey.slice(-4) }
    : input.removeKey
      ? { enc: null, last4: null }
      : null;
  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        assistantProvider: provider,
        assistantEnabled: input.enabled && willHaveKey,
        ...(provider === "gemini"
          ? { geminiModel: input.model, ...(keyData ? { geminiApiKeyEnc: keyData.enc, geminiApiKeyLast4: keyData.last4 } : {}) }
          : { assistantModel: input.model, ...(keyData ? { assistantApiKeyEnc: keyData.enc, assistantApiKeyLast4: keyData.last4 } : {}) }),
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

function validKeyFormat(provider: AssistantProvider, key: string) {
  return provider === "gemini" ? /^\S{20,}$/.test(key) : /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key);
}

// Makes one tiny request with the key (the typed one, or the saved one).
export async function testAssistantConnection(
  input: { provider: string; apiKey: string; model: string },
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const resolved = await resolveClient(targetClientId);
  if (resolved.error !== undefined) return { error: resolved.error };
  const { clientId, d } = resolved;
  if (!isProvider(input.provider)) return { error: d.invalidProvider };
  const provider = input.provider;
  let key = input.apiKey.trim();
  if (!key) {
    const saved = await prisma.client.findUnique({ where: { id: clientId }, select: { assistantApiKeyEnc: true, geminiApiKeyEnc: true } });
    const enc = provider === "gemini" ? saved?.geminiApiKeyEnc : saved?.assistantApiKeyEnc;
    if (!enc) return { error: d.keyRequired };
    key = decryptSecret(enc);
  }
  const model = ASSISTANT_MODELS[provider].some((m) => m.id === input.model) ? input.model : DEFAULT_MODEL[provider];

  if (provider === "gemini") {
    try {
      await testGemini(key, model);
      return { success: true };
    } catch (error) {
      if (error instanceof GeminiError && error.kind === "auth") return { error: d.testAuthFailed };
      if (error instanceof GeminiError && error.kind === "rate") return { error: d.testRateLimited };
      if (error instanceof GeminiError && /^404/.test(error.message)) return { error: d.testModelNotFound };
      return { error: `${d.testFailed} ${error instanceof Error ? error.message.slice(0, 160) : ""}`.trim() };
    }
  }
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
