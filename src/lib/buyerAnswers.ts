// Questions the buyer answers themself (respondedBy BUYER): when one is marked
// required, the RFP can't be published until it has an answer. Client-safe.

export type BuyerQuestionLike = {
  key: string; // clientKey (form) or id (stored)
  text: string;
  type: string;
  required: boolean;
  respondedBy: string;
  buyerAnswerValue: string | null | undefined;
  dependsOnKey: string | null | undefined; // another question this one depends on
  dependsOnHeaderField: string | null | undefined; // "commodity" | "region" | "custom:<key>"
  dependsOnValue: string | null | undefined;
};

type Header = {
  commodity: string | null | undefined;
  region: string | null | undefined;
  custom: Record<string, string>;
  estimatedPrice?: number | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

// Does the question apply to this RFP? A question conditioned on a header value
// that isn't met is not shown, so it can't be demanded. One conditioned on a
// supplier's answer can't be evaluated while creating, so it is not demanded either.
function applies(q: BuyerQuestionLike, all: Map<string, BuyerQuestionLike>, header: Header): boolean {
  if (q.dependsOnHeaderField) {
    const field = q.dependsOnHeaderField;
    const current = field.startsWith("custom:")
      ? header.custom[field.slice("custom:".length)]
      : field === "commodity"
        ? header.commodity
        : field === "region"
          ? header.region
          : "";
    return norm(current) === norm(q.dependsOnValue);
  }
  if (q.dependsOnKey) {
    const parent = all.get(q.dependsOnKey);
    if (!parent || parent.respondedBy !== "BUYER") return false;
    return applies(parent, all, header) && norm(parent.buyerAnswerValue) === norm(q.dependsOnValue);
  }
  return true;
}

// Error text listing the required buyer questions left unanswered.
export function buyerAnswersMessage(
  dictionary: { rfpActions: { buyerAnswersRequired: string } },
  missing: { text: string }[],
) {
  return dictionary.rfpActions.buyerAnswersRequired.replace("{list}", missing.map((m) => m.text).join(" · "));
}

// Required buyer questions still without an answer (INFO blocks never need one).
export function missingBuyerAnswers(
  questions: BuyerQuestionLike[],
  header: Header,
): { text: string; attachment: boolean }[] {
  const all = new Map(questions.map((q) => [q.key, q]));
  return questions
    .filter(
      (q) =>
        q.respondedBy === "BUYER" &&
        q.required &&
        q.type !== "INFO" &&
        !(q.buyerAnswerValue ?? "").trim() &&
        applies(q, all, header),
    )
    .map((q) => ({ text: q.text, attachment: q.type === "ATTACHMENT" }));
}

// Whether a template question is part of the RFP being built. One conditioned on a
// header value shows when it matches; one conditioned on a question the buyer answers
// themself (an internal question) shows only once that question is itself shown and
// answered with the required value, and otherwise it doesn't appear at all. A question
// conditioned on a supplier's answer can't be known while creating, so it stays.
// Questions the buyer added by hand always stay (they'd vanish while typing).
export type ShownQuestionLike = {
  key: string;
  fromTemplate: boolean;
  respondedBy: string;
  buyerAnswerValue: string | null | undefined;
  dependsOnKey: string | null | undefined;
  dependsOnHeaderField: string | null | undefined;
  dependsOnValue: string | null | undefined;
};

export function questionShown(
  q: ShownQuestionLike,
  byKey: Map<string, ShownQuestionLike>,
  header: { commodity: string | null | undefined; region: string | null | undefined; custom: Record<string, string> },
  depth = 0,
): boolean {
  if (!q.fromTemplate) return true;
  if (q.dependsOnHeaderField) {
    const field = q.dependsOnHeaderField;
    const current = field.startsWith("custom:")
      ? header.custom[field.slice("custom:".length)]
      : field === "commodity"
        ? header.commodity
        : field === "region"
          ? header.region
          : "";
    return norm(current) === norm(q.dependsOnValue);
  }
  if (q.dependsOnKey) {
    const parent = byKey.get(q.dependsOnKey);
    if (!parent || depth > 6) return false;
    // A question under one that is itself hidden stays hidden.
    if (!questionShown(parent, byKey, header, depth + 1)) return false;
    if (parent.respondedBy !== "BUYER") return true;
    return norm(parent.buyerAnswerValue) === norm(q.dependsOnValue);
  }
  return true;
}
