import "server-only";
import { TOOLS, executeTool, type ToolContext } from "@/lib/assistant/tools";

// Gemini through the REST generateContent endpoint (no SDK): the same tools as
// the Claude path, translated to function declarations. The model's own
// `content` is echoed back untouched on every tool turn, which keeps any
// thought signatures Gemini 3 models attach to function calls.

const BASE = () => process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta";
const MAX_STEPS = 8;

type Part = Record<string, unknown> & { text?: string; thought?: boolean; functionCall?: { name: string; args?: Record<string, unknown>; id?: string } };
type Content = { role: "user" | "model"; parts: Part[] };

export class GeminiError extends Error {
  constructor(public kind: "auth" | "rate" | "api", message: string) {
    super(message);
  }
}

// Gemini's schema dialect has no union types: collapse them to string.
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "additionalProperties") continue;
    out[key] = key === "type" && Array.isArray(value) ? "string" : toGeminiSchema(value);
  }
  return out;
}

const FUNCTION_DECLARATIONS = TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: toGeminiSchema(tool.input_schema),
}));

async function generate(apiKey: string, model: string, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${BASE()}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = JSON.stringify(data?.error?.details ?? "");
      if (res.status === 401 || res.status === 403 || reason.includes("API_KEY_INVALID")) throw new GeminiError("auth", data?.error?.message ?? "auth");
      if (res.status === 429) throw new GeminiError("rate", data?.error?.message ?? "rate");
      throw new GeminiError("api", `${res.status} ${data?.error?.message ?? ""}`.trim());
    }
    return data as {
      candidates?: { content?: Content; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    };
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    throw new GeminiError("api", error instanceof Error ? error.message : "network");
  } finally {
    clearTimeout(timer);
  }
}

// Used by the settings screen's "Test connection".
export async function testGemini(apiKey: string, model: string) {
  await generate(apiKey, model, {
    contents: [{ role: "user", parts: [{ text: "Reply with: ok" }] }],
    generationConfig: { maxOutputTokens: 512 },
  });
}

export type GeminiOutcome =
  | { kind: "reply"; reply: string; inputTokens: number; outputTokens: number }
  | { kind: "refused"; inputTokens: number; outputTokens: number }
  | { kind: "maxSteps"; inputTokens: number; outputTokens: number };

export async function runGemini(options: {
  apiKey: string;
  model: string;
  system: string;
  history: { role: "user" | "assistant"; text: string }[];
  ctx: ToolContext;
  toolsUsed: string[];
}): Promise<GeminiOutcome> {
  const contents: Content[] = options.history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] }));
  let inputTokens = 0;
  let outputTokens = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const data = await generate(options.apiKey, options.model, {
      systemInstruction: { parts: [{ text: options.system }] },
      contents,
      tools: [{ function_declarations: FUNCTION_DECLARATIONS }],
      generationConfig: { maxOutputTokens: 8192 },
    });
    inputTokens += data.usageMetadata?.promptTokenCount ?? 0;
    outputTokens += (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0);

    const candidate = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || !candidate?.content) return { kind: "refused", inputTokens, outputTokens };
    if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(candidate.finishReason ?? "")) {
      return { kind: "refused", inputTokens, outputTokens };
    }

    const parts = candidate.content.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      const reply = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
      return { kind: "reply", reply: reply || "…", inputTokens, outputTokens };
    }

    contents.push({ role: "model", parts }); // as received: keeps thought signatures
    const answers: Part[] = [];
    for (const part of calls) {
      const call = part.functionCall!;
      options.toolsUsed.push(call.name);
      let result: unknown;
      try {
        const text = await executeTool(call.name, (call.args ?? {}) as Record<string, unknown>, options.ctx);
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      } catch (error) {
        console.error("[assistant:gemini:tool]", call.name, error);
        result = { error: "The tool failed. Try a different approach." };
      }
      answers.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { result } } });
    }
    contents.push({ role: "user", parts: answers });
  }
  return { kind: "maxSteps", inputTokens, outputTokens };
}
