export type ConditionedQuestion = {
  dependsOnQuestionId: string | null;
  dependsOnHeaderField: string | null;
  dependsOnValue: string | null;
};

export type HeaderValues = {
  commodity: string | null;
  region: string | null;
};

/**
 * A question with no condition is always relevant. One with a condition
 * only becomes relevant once the referenced header field or question
 * answer matches — this holds regardless of whether the question is
 * required/prerequisite/internal: visibility always wins over "required".
 */
export function isQuestionConditionMet(
  question: ConditionedQuestion,
  header: HeaderValues,
  answerValuesByQuestionId: Record<string, string>,
) {
  if (question.dependsOnHeaderField) {
    const val =
      question.dependsOnHeaderField === "commodity"
        ? header.commodity
        : header.region;
    return (
      (val ?? "").trim().toLowerCase() ===
      (question.dependsOnValue ?? "").trim().toLowerCase()
    );
  }
  if (question.dependsOnQuestionId) {
    const val = answerValuesByQuestionId[question.dependsOnQuestionId] ?? "";
    return (
      val.trim().toLowerCase() ===
      (question.dependsOnValue ?? "").trim().toLowerCase()
    );
  }
  return true;
}
