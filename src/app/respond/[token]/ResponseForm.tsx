"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { isQuestionConditionMet } from "@/lib/questionCondition";
import { submitResponse } from "./actions";

type Item = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  decimals: number;
  customFields: string | null;
};

type Question = {
  id: string;
  text: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "MONEY" | "ATTACHMENT" | "YES_NO";
  options: string | null;
  required: boolean;
  isPrerequisite: boolean;
  numberMin: number | null;
  numberMax: number | null;
  dependsOnQuestionId: string | null;
  dependsOnHeaderField: string | null;
  dependsOnValue: string | null;
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Enviar cotización"}
    </button>
  );
}

export function ResponseForm({
  token,
  items,
  questions,
  rfpCommodity,
  rfpRegion,
}: {
  token: string;
  items: Item[];
  questions: Question[];
  rfpCommodity: string | null;
  rfpRegion: string | null;
}) {
  const [state, formAction] = useActionState(
    async (_prevState: { error: string | null }, formData: FormData) =>
      submitResponse(token, formData),
    { error: null },
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function isVisible(q: Question) {
    return isQuestionConditionMet(
      q,
      { commodity: rfpCommodity, region: rfpRegion },
      answers,
    );
  }

  const prerequisites = questions.filter(
    (q) => q.isPrerequisite && isVisible(q),
  );
  const regularQuestions = questions.filter(
    (q) => !q.isPrerequisite && isVisible(q),
  );

  return (
    <form action={formAction} className="space-y-8">
      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {prerequisites.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">
            Requisitos para participar
          </h2>
          <p className="mt-1 text-sm text-amber-700">
            Debes aceptar lo siguiente antes de poder enviar tu cotización.
          </p>
          <div className="mt-4 space-y-3">
            {prerequisites.map((q) => (
              <label
                key={q.id}
                className="flex items-start gap-2.5 text-sm text-amber-900"
              >
                <input
                  type="checkbox"
                  name={`question-${q.id}`}
                  required
                  className="mt-0.5"
                />
                {q.text}
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Precios por artículo
        </h2>
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const customFields = item.customFields
              ? (JSON.parse(item.customFields) as {
                  label: string;
                  value: string;
                }[])
              : [];
            return (
              <div
                key={item.id}
                className="grid grid-cols-1 items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-6">
                  <p className="font-medium text-slate-800">
                    {item.code && (
                      <span className="mr-1.5 text-xs font-normal text-slate-400">
                        {item.code}
                      </span>
                    )}
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-xs text-slate-500">
                      {item.description}
                    </p>
                  )}
                  {customFields.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {customFields.map((f, i) => (
                        <li key={i} className="text-xs text-slate-400">
                          {f.label}: {f.value}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-sm text-slate-500 sm:col-span-3">
                  {item.quantity} {item.unit}
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="number"
                    name={`item-${item.id}`}
                    min={0}
                    step={(1 / 10 ** item.decimals).toFixed(item.decimals)}
                    required
                    className={inputClass()}
                    placeholder="Precio unitario (USD)"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {regularQuestions.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Preguntas del comprador
          </h2>
          <div className="mt-4 space-y-4">
            {regularQuestions.map((q) => (
              <div key={q.id}>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {q.text}
                  {q.required && <span className="text-red-500"> *</span>}
                  {q.type === "NUMBER" &&
                    (q.numberMin !== null || q.numberMax !== null) && (
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        (entre {q.numberMin ?? "–∞"} y {q.numberMax ?? "∞"})
                      </span>
                    )}
                </label>
                {q.type === "SELECT" ? (
                  <select
                    name={`question-${q.id}`}
                    required={q.required}
                    className={inputClass()}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="" disabled>
                      Selecciona una opción
                    </option>
                    {(JSON.parse(q.options ?? "[]") as string[]).map(
                      (opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ),
                    )}
                  </select>
                ) : q.type === "YES_NO" ? (
                  <select
                    name={`question-${q.id}`}
                    required={q.required}
                    className={inputClass()}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="" disabled>
                      Selecciona una opción
                    </option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                ) : q.type === "NUMBER" ? (
                  <input
                    type="number"
                    step="any"
                    min={q.numberMin ?? undefined}
                    max={q.numberMax ?? undefined}
                    name={`question-${q.id}`}
                    required={q.required}
                    className={inputClass()}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                  />
                ) : q.type === "MONEY" ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      name={`question-${q.id}`}
                      required={q.required}
                      className={`${inputClass()} pl-6`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ) : q.type === "ATTACHMENT" ? (
                  <input
                    type="file"
                    name={`question-${q.id}`}
                    required={q.required}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-700 hover:file:bg-violet-100"
                  />
                ) : (
                  <textarea
                    name={`question-${q.id}`}
                    required={q.required}
                    rows={2}
                    className={inputClass()}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Notas adicionales (opcional)
        </label>
        <textarea name="notes" rows={3} className={inputClass()} />
      </section>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
