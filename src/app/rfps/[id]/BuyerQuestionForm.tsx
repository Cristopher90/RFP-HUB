"use client";

import { useTransition } from "react";
import { setBuyerAnswer } from "./actions";

type Question = {
  id: string;
  text: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "MONEY" | "ATTACHMENT" | "YES_NO" | "INFO";
  options: string | null;
  numberMin: number | null;
  numberMax: number | null;
  buyerAnswerValue: string | null;
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function BuyerQuestionForm({
  rfpId,
  question,
}: {
  rfpId: string;
  question: Question;
}) {
  const [pending, startTransition] = useTransition();
  const action = setBuyerAnswer.bind(null, rfpId, question.id);

  if (question.type === "INFO") return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await action(formData);
    });
  }

  if (question.type === "ATTACHMENT") {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {question.buyerAnswerValue &&
          (() => {
            const [href, filename] = question.buyerAnswerValue!.split("|");
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-600 underline"
              >
                {filename ?? "archivo actual"}
              </a>
            );
          })()}
        <input type="file" name="value" className="text-xs" />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      {question.type === "SELECT" || question.type === "YES_NO" ? (
        <select
          name="value"
          defaultValue={question.buyerAnswerValue ?? ""}
          className={inputClass()}
        >
          <option value="">–</option>
          {(question.type === "YES_NO"
            ? ["Sí", "No"]
            : (JSON.parse(question.options ?? "[]") as string[])
          ).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            question.type === "NUMBER" || question.type === "MONEY"
              ? "number"
              : "text"
          }
          step={question.type === "MONEY" ? "0.01" : "any"}
          min={question.type === "NUMBER" ? (question.numberMin ?? undefined) : undefined}
          max={question.type === "NUMBER" ? (question.numberMax ?? undefined) : undefined}
          name="value"
          defaultValue={question.buyerAnswerValue ?? ""}
          className={inputClass()}
        />
      )}
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
