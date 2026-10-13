"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { saveAssistantSettings, testAssistantConnection } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

type Provider = "anthropic" | "gemini";
type ProviderState = { model: string; hasKey: boolean; last4: string | null };
type ModelOption = { id: string; label: string; note: string };

export function AssistantSettingsForm({
  targetClientId,
  initial,
  models,
  usage,
}: {
  targetClientId: string;
  initial: { enabled: boolean; provider: Provider; anthropic: ProviderState; gemini: ProviderState };
  models: Record<Provider, ModelOption[]>;
  usage: { questions: number; inputTokens: number; outputTokens: number; users: number };
}) {
  const { t } = usePreferences();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [modelByProvider, setModelByProvider] = useState<Record<Provider, string>>({
    anthropic: initial.anthropic.model,
    gemini: initial.gemini.model,
  });
  const [apiKey, setApiKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const current = initial[provider];
  const model = modelByProvider[provider];

  function switchProvider(next: Provider) {
    setProvider(next);
    setApiKey("");
    setRemoveKey(false);
    setMessage(null);
  }

  function run(action: () => Promise<{ error: string } | { success: true }>, okText: string, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setMessage({ kind: "error", text: result.error });
      else {
        setMessage({ kind: "ok", text: okText });
        after?.();
      }
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t("assistantSettings.enable")}
        </label>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{t("assistantSettings.provider")}</label>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            {(["anthropic", "gemini"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => switchProvider(p)}
                className={`px-4 py-2 text-sm font-medium ${provider === p ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {t(`assistantSettings.provider_${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{t(`assistantSettings.apiKey_${provider}`)}</label>
          <input
            type="password"
            autoComplete="off"
            className={inputClass()}
            placeholder={current.hasKey && !removeKey ? `•••••••• ${current.last4 ?? ""}` : provider === "gemini" ? "AIza..." : "sk-ant-..."}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            {current.hasKey ? t("assistantSettings.keySaved").replace("{last4}", current.last4 ?? "") : t(`assistantSettings.keyHelp_${provider}`)}
          </p>
          {current.hasKey && (
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" checked={removeKey} onChange={(e) => setRemoveKey(e.target.checked)} />
              {t("assistantSettings.removeKey")}
            </label>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{t("assistantSettings.model")}</label>
          <select className={inputClass()} value={model} onChange={(e) => setModelByProvider((prev) => ({ ...prev, [provider]: e.target.value }))}>
            {models[provider].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {t(`assistantSettings.note_${m.note.replace(" ", "_")}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => testAssistantConnection({ provider, apiKey, model }, targetClientId), t("assistantSettings.testOk"))}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {t("assistantSettings.test")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => saveAssistantSettings({ provider, enabled, model, apiKey, removeKey }, targetClientId),
                t("assistantSettings.saved"),
                () => {
                  setApiKey("");
                  setRemoveKey(false);
                },
              )
            }
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? t("assistantSettings.saving") : t("assistantSettings.save")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">{t("assistantSettings.usageTitle")}</h2>
        <ul className="mt-2 space-y-1">
          <li>{t("assistantSettings.usageUsers").replace("{count}", String(usage.users))}</li>
          <li>{t("assistantSettings.usageQuestions").replace("{count}", String(usage.questions))}</li>
          <li>
            {t("assistantSettings.usageTokens")
              .replace("{input}", usage.inputTokens.toLocaleString())
              .replace("{output}", usage.outputTokens.toLocaleString())}
          </li>
        </ul>
      </section>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{t("assistantSettings.privacy")}</p>
    </div>
  );
}
