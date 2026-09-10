"use client";

import { useMemo, useState, useTransition } from "react";
import { formatRfpNumber } from "@/lib/format";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { awardCriteriaLabel } from "@/i18n/labels";
import { BarChart } from "@/components/BarChart";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ApprovalFlowBanner } from "../ApprovalFlowBanner";
import type { ApprovalLevelView } from "@/lib/approvalEngine";
import {
  awardInvitation,
  approveAward,
  rejectAward,
  revokeAward,
  scoreAnswer,
  sendApprovalReminder,
  confirmAddToCatalog,
  type AwardCriteria,
} from "./actions";

type Item = { id: string; name: string; weight: number };
type Question = { id: string; text: string; weight: number; type: string };
type AnswerData = {
  id: string;
  questionId: string;
  value: string;
  score: number | null;
};
type SupplierRow = {
  invitationId: string;
  supplierId: string;
  name: string;
  company: string;
  color: string;
  totalPrice: number;
  itemPrices: { itemId: string; unitPrice: number }[];
  answers: AnswerData[];
};

const ALL_AWARD_CRITERIA: AwardCriteria[] = ["ITEMS", "QUESTIONS", "WEIGHTED", "PRICE"];

export function AwardPanel({
  rfpId,
  rfpNumber,
  scoringEnabled,
  items,
  questions,
  suppliers,
  awardedInvitationId: initialAwardedId,
  awardedAt,
  initialCriteria,
  initialPriceWeightPct,
  initialPendingInvitationId,
  awardLevels,
  canDecideAward,
}: {
  rfpId: string;
  rfpNumber: number;
  scoringEnabled: boolean;
  items: Item[];
  questions: Question[];
  suppliers: SupplierRow[];
  awardedInvitationId: string | null;
  awardedAt: string | null;
  initialCriteria: AwardCriteria | null;
  initialPriceWeightPct: number | null;
  initialPendingInvitationId: string | null;
  awardLevels: ApprovalLevelView[];
  canDecideAward: boolean;
}) {
  const { formatCurrency, formatDateTime, dictionary, t } = usePreferences();
  const [answerScores, setAnswerScores] = useState<Record<string, number | null>>(
    () =>
      Object.fromEntries(
        suppliers.flatMap((s) => s.answers.map((a) => [a.id, a.score])),
      ),
  );
  const [criteria, setCriteria] = useState<AwardCriteria>(
    scoringEnabled ? (initialCriteria ?? "WEIGHTED") : "PRICE",
  );
  const [itemsWeightPct, setItemsWeightPct] = useState(
    initialPriceWeightPct ?? 60,
  );
  const [awardedId, setAwardedId] = useState(initialAwardedId);
  const [pendingId, setPendingId] = useState(initialPendingInvitationId);
  const [pending, startTransition] = useTransition();
  const [catalogPrompt, setCatalogPrompt] = useState<{ invitationId: string } | null>(
    null,
  );
  const [catalogName, setCatalogName] = useState(formatRfpNumber(rfpNumber));
  const [catalogSaved, setCatalogSaved] = useState(false);

  const totalQuestionWeight = questions.reduce((sum, q) => sum + q.weight, 0);
  const totalItemWeight = items.reduce((sum, i) => sum + i.weight, 0);

  const itemBestPrice = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const prices = suppliers
        .map((s) => s.itemPrices.find((p) => p.itemId === item.id)?.unitPrice)
        .filter((p): p is number => p !== undefined);
      if (prices.length > 0) map.set(item.id, Math.min(...prices));
    }
    return map;
  }, [items, suppliers]);

  const bestTotalPrice = useMemo(() => {
    const totals = suppliers.map((s) => s.totalPrice).filter((p) => p > 0);
    return totals.length > 0 ? Math.min(...totals) : null;
  }, [suppliers]);

  const ranked = useMemo(() => {
    return suppliers
      .map((s) => {
        let itemsScore = 0;
        if (totalItemWeight > 0) {
          let acc = 0;
          for (const item of items) {
            const price = s.itemPrices.find(
              (p) => p.itemId === item.id,
            )?.unitPrice;
            const best = itemBestPrice.get(item.id);
            const score = price && best ? (best / price) * 100 : 0;
            acc += score * item.weight;
          }
          itemsScore = acc / totalItemWeight;
        }

        let questionScore: number | null = null;
        if (totalQuestionWeight > 0) {
          let scoredWeight = 0;
          let acc = 0;
          for (const a of s.answers) {
            const score = answerScores[a.id];
            if (score === null || score === undefined) continue;
            const question = questions.find((q) => q.id === a.questionId);
            const weight = question?.weight ?? 1;
            acc += score * weight;
            scoredWeight += weight;
          }
          questionScore = scoredWeight > 0 ? (acc / scoredWeight) * 10 : null;
        }

        const priceScore =
          bestTotalPrice && s.totalPrice > 0
            ? (bestTotalPrice / s.totalPrice) * 100
            : 0;

        const combined =
          criteria === "PRICE"
            ? priceScore
            : criteria === "ITEMS"
              ? itemsScore
              : criteria === "QUESTIONS"
                ? (questionScore ?? 0)
                : (itemsWeightPct / 100) * itemsScore +
                  ((100 - itemsWeightPct) / 100) * (questionScore ?? 0);

        return { ...s, itemsScore, questionScore, priceScore, combined };
      })
      .sort((a, b) => b.combined - a.combined);
  }, [
    suppliers,
    answerScores,
    criteria,
    itemsWeightPct,
    itemBestPrice,
    bestTotalPrice,
    totalItemWeight,
    totalQuestionWeight,
    questions,
    items,
  ]);

  function handleScoreChange(answerId: string, raw: string) {
    const score = raw === "" ? null : Number(raw);
    setAnswerScores((prev) => ({ ...prev, [answerId]: score }));
    startTransition(async () => {
      await scoreAnswer(rfpId, answerId, score);
    });
  }

  function handleAward(invitationId: string) {
    startTransition(async () => {
      const result = await awardInvitation(rfpId, invitationId, criteria, itemsWeightPct);
      if (result?.status === "AWARDED") {
        setAwardedId(invitationId);
        setPendingId(null);
        setCatalogPrompt({ invitationId });
      } else if (result?.status === "PENDING") {
        setPendingId(invitationId);
      }
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeAward(rfpId);
      setAwardedId(null);
    });
  }

  function handleApproveAward() {
    startTransition(async () => {
      const result = await approveAward(rfpId);
      if (result && "completed" in result && result.completed && result.invitationId) {
        setAwardedId(result.invitationId);
        setCatalogPrompt({ invitationId: result.invitationId });
      }
      setPendingId(null);
    });
  }

  function handleConfirmAddToCatalog() {
    if (!catalogPrompt) return;
    const invitationId = catalogPrompt.invitationId;
    startTransition(async () => {
      const result = await confirmAddToCatalog(rfpId, invitationId, catalogName);
      if (!("error" in result)) setCatalogSaved(true);
      setCatalogPrompt(null);
    });
  }

  function handleRejectAward(reason: string) {
    startTransition(async () => {
      await rejectAward(rfpId, reason);
      setPendingId(null);
    });
  }

  function handleSendReminder(approvalId: string) {
    startTransition(async () => {
      await sendApprovalReminder(rfpId, approvalId);
    });
  }

  const awardedSupplier = suppliers.find(
    (s) => s.invitationId === awardedId,
  );
  const pendingSupplier = suppliers.find((s) => s.invitationId === pendingId);

  return (
    <div className="space-y-8">
      {catalogPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setCatalogPrompt(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-800">
              {t("awardPanel.addToCatalogTitle")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t("awardPanel.addToCatalogHint")}
            </p>
            <input
              autoFocus
              value={catalogName}
              onChange={(e) => setCatalogName(e.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCatalogPrompt(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t("awardPanel.skip")}
              </button>
              <button
                type="button"
                disabled={pending || !catalogName.trim()}
                onClick={handleConfirmAddToCatalog}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {t("awardPanel.addToCatalog")}
              </button>
            </div>
          </div>
        </div>
      )}

      {catalogSaved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t("awardPanel.itemsAddedToCatalog")}
        </div>
      )}

      {awardedSupplier && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              {t("awardPanel.awardedTo")} {awardedSupplier.name} ({awardedSupplier.company}
              )
            </p>
            {awardedAt && (
              <p className="text-xs text-emerald-700">
                {formatDateTime(awardedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={pending}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {t("awardPanel.revokeAward")}
          </button>
        </div>
      )}

      {pendingSupplier && (
        <ApprovalFlowBanner
          title={`${t("awardPanel.pendingApprovalTitle")}: ${pendingSupplier.name} (${pendingSupplier.company})`}
          levels={awardLevels}
          canDecide={canDecideAward}
          pending={pending}
          onApprove={handleApproveAward}
          onReject={handleRejectAward}
          onSendReminder={handleSendReminder}
        />
      )}

      <CollapsibleSection
        title={t("awardPanel.criteriaTitle")}
        storageKey="award-criteria"
      >
        {!scoringEnabled ? (
          <p className="text-sm text-slate-500">
            {t("awardPanel.noScoringHint")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ALL_AWARD_CRITERIA.filter((c) => c !== "PRICE").map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCriteria(c)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    criteria === c
                      ? "border-violet-600 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {awardCriteriaLabel(dictionary, c)}
                </button>
              ))}
            </div>
            {criteria === "WEIGHTED" && (
              <div className="mt-5">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{t("awardPanel.items")} {itemsWeightPct}%</span>
                  <span>{t("awardPanel.questions")} {100 - itemsWeightPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={itemsWeightPct}
                  onChange={(e) => setItemsWeightPct(Number(e.target.value))}
                  className="w-full accent-violet-600"
                />
              </div>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title={t("awardPanel.scoresTitle")} storageKey="award-scores">
        {!scoringEnabled ? (
          <p className="text-sm text-slate-500">{t("awardPanel.notScored")}</p>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {t("awardPanel.itemsScoreTitle")}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {t("awardPanel.itemsScoreHint")}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-slate-700">{item.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {t("awardPanel.weightPrefix")} {item.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {questions.length > 0 && (
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold text-slate-800">
                  {t("awardPanel.answersEvalTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t("awardPanel.answersEvalHint")}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {suppliers.map((s) => (
                    <div
                      key={s.invitationId}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-4"
                    >
                      <p className="flex items-center gap-1.5 font-medium text-slate-900">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                          aria-hidden
                        />
                        {s.name}
                        <span className="font-normal text-slate-400">
                          ({s.company})
                        </span>
                      </p>
                      <div className="mt-3 space-y-3">
                        {questions.map((q) => {
                          const answer = s.answers.find(
                            (a) => a.questionId === q.id,
                          );
                          if (!answer) return null;
                          return (
                            <div
                              key={q.id}
                              className="flex items-start justify-between gap-3 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-slate-500">
                                  {q.text}{" "}
                                  <span className="text-slate-400">
                                    ({t("awardPanel.weightPrefix")} {q.weight})
                                  </span>
                                </p>
                                <p className="truncate text-sm text-slate-800">
                                  {q.type === "ATTACHMENT" ? (
                                    (() => {
                                      const [href, filename] =
                                        answer.value.split("|");
                                      return (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-violet-600 underline hover:text-violet-700"
                                        >
                                          {filename ?? t("awardPanel.viewFile")}
                                        </a>
                                      );
                                    })()
                                  ) : q.type === "MONEY" ? (
                                    formatCurrency(Number(answer.value))
                                  ) : (
                                    answer.value
                                  )}
                                </p>
                              </div>
                              <select
                                value={answerScores[answer.id] ?? ""}
                                onChange={(e) =>
                                  handleScoreChange(answer.id, e.target.value)
                                }
                                className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-sm"
                              >
                                <option value="">–</option>
                                {Array.from({ length: 11 }, (_, i) => i).map(
                                  (n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t("awardPanel.resultTitle")}
        storageKey="award-results"
      >
        <div>
          <BarChart
            data={ranked.map((s) => ({
              id: s.invitationId,
              label: s.name,
              sublabel: s.company,
              value: Math.round(s.combined * 10) / 10,
              color: s.color,
            }))}
            valueFormatter={(v) => `${v.toFixed(1)} ${t("awardPanel.pointsSuffix")}`}
            bestId={ranked[0]?.invitationId ?? null}
            bestLabel={t("awardPanel.firstPlace")}
          />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">{t("awardPanel.supplier")}</th>
                <th className="py-2 pr-4">{t("awardPanel.totalPrice")}</th>
                {scoringEnabled && (
                  <>
                    <th className="py-2 pr-4">{t("awardPanel.itemsScoreColumn")}</th>
                    <th className="py-2 pr-4">{t("awardPanel.questionsScoreColumn")}</th>
                  </>
                )}
                <th className="py-2 pr-4">{t("awardPanel.finalScore")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranked.map((s, index) => (
                <tr
                  key={s.invitationId}
                  className={
                    s.invitationId === awardedId
                      ? "bg-emerald-50"
                      : s.invitationId === pendingId
                        ? "bg-amber-50"
                        : ""
                  }
                >
                  <td className="py-3 pr-4 font-semibold text-slate-400">
                    {index + 1}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      {s.name}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {formatCurrency(s.totalPrice)}
                  </td>
                  {scoringEnabled && (
                    <>
                      <td className="py-3 pr-4 text-slate-600">
                        {s.itemsScore.toFixed(0)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {s.questionScore === null
                          ? t("awardPanel.notEvaluated")
                          : s.questionScore.toFixed(0)}
                      </td>
                    </>
                  )}
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {s.combined.toFixed(1)}
                  </td>
                  <td className="py-3 text-right">
                    {s.invitationId === awardedId ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        {t("awardPanel.awarded")}
                      </span>
                    ) : s.invitationId === pendingId ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {t("awardPanel.pendingApproval")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAward(s.invitationId)}
                        disabled={pending || Boolean(pendingId)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        {t("awardPanel.award")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {scoringEnabled
            ? t("awardPanel.scoringFootnote")
            : t("awardPanel.priceOnlyFootnote")}
        </p>
      </CollapsibleSection>
    </div>
  );
}
