import "server-only";
import { prisma } from "@/lib/prisma";

export type AssistantProvider = "anthropic" | "gemini";

export const ASSISTANT_PROVIDERS: AssistantProvider[] = ["anthropic", "gemini"];

// Models offered per provider (exact API model IDs).
export const ASSISTANT_MODELS: Record<AssistantProvider, { id: string; label: string; note: string }[]> = {
  anthropic: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "recommended" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "cheaper" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "cheapest" },
    { id: "claude-fable-5-1", label: "Claude Fable 5.1", note: "most capable" },
  ],
  gemini: [
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "recommended" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", note: "most capable" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "cheapest" },
  ],
};

export const DEFAULT_MODEL: Record<AssistantProvider, string> = { anthropic: "claude-opus-5-5", gemini: "gemini-3.8-flash" };

export function isProvider(value: string): value is AssistantProvider {
  return (ASSISTANT_PROVIDERS as string[]).includes(value);
}

type AssistantUser = { id: string; clientId: string | null; canUseAssistant: boolean };

// The assistant is available to a user when they are marked for it AND their
// client turned it on and saved an API key for the provider it chose.
export async function assistantAccess(user: AssistantUser) {
  if (!user.canUseAssistant || !user.clientId) return null;
  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: {
      id: true, description: true, currency: true, assistantEnabled: true, assistantProvider: true,
      assistantApiKeyEnc: true, assistantModel: true, geminiApiKeyEnc: true, geminiModel: true,
    },
  });
  if (!client?.assistantEnabled) return null;
  const provider: AssistantProvider = isProvider(client.assistantProvider) ? client.assistantProvider : "anthropic";
  const encryptedKey = provider === "gemini" ? client.geminiApiKeyEnc : client.assistantApiKeyEnc;
  if (!encryptedKey) return null;
  const wanted = provider === "gemini" ? client.geminiModel : client.assistantModel;
  const model = ASSISTANT_MODELS[provider].some((m) => m.id === wanted) ? wanted : DEFAULT_MODEL[provider];
  return { client, provider, model, encryptedKey };
}
