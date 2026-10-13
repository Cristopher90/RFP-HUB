import "server-only";
import { prisma } from "@/lib/prisma";

export const ASSISTANT_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "recommended" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "cheaper" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "cheapest" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1", note: "most capable" },
] as const;

type AssistantUser = { id: string; clientId: string | null; canUseAssistant: boolean };

// The assistant is available to a user when they are marked for it AND their
// client turned it on and saved an API key.
export async function assistantAccess(user: AssistantUser) {
  if (!user.canUseAssistant || !user.clientId) return null;
  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { id: true, description: true, currency: true, assistantEnabled: true, assistantApiKeyEnc: true, assistantModel: true },
  });
  if (!client?.assistantEnabled || !client.assistantApiKeyEnc) return null;
  return {
    client,
    model: ASSISTANT_MODELS.some((m) => m.id === client.assistantModel) ? client.assistantModel : "claude-opus-5-5",
    encryptedKey: client.assistantApiKeyEnc,
  };
}
