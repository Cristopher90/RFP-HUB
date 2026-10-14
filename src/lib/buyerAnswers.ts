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
  dictionary: { rfpActions: { buyerAnswersRequired: string; buyerAttachmentHint: string } },
  missing: { text: string; attachment: boolean }[],
) {
  const base = dictionary.rfpActions.buyerAnswersRequired.replace("{list}", missing.map((m) => m.text).join(" · "));
  return missing.some((m) => m.attachment) ? `${base} ${dictionary.rfpActions.buyerAttachmentHint}` : base;
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
