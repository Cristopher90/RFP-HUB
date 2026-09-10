import type { Dictionary } from "./getDictionary";

// Small named lookups over the dictionary's enum-keyed namespaces, so call
// sites read like the old `ROLE_LABEL[role]` maps but stay translated.
export function roleLabel(dictionary: Dictionary, role: string): string {
  return (dictionary.roles as Record<string, string>)[role] ?? role;
}

export function statusLabel(dictionary: Dictionary, status: string): string {
  return (dictionary.status as Record<string, string>)[status] ?? status;
}

export function masterDataKindLabel(dictionary: Dictionary, kind: string): string {
  return (dictionary.masterDataKind as Record<string, string>)[kind] ?? kind;
}

export function approvalStageLabel(dictionary: Dictionary, stage: string): string {
  return (dictionary.approvalStage as Record<string, string>)[stage] ?? stage;
}

export function questionTypeLabel(dictionary: Dictionary, type: string): string {
  return (dictionary.questionType as Record<string, string>)[type] ?? type;
}

export function requiresAnswerLabel(dictionary: Dictionary, responder: string): string {
  return (dictionary.requiresAnswer as Record<string, string>)[responder] ?? responder;
}

export function priceConditionLabel(dictionary: Dictionary, condition: string): string {
  return (dictionary.priceCondition as Record<string, string>)[condition] ?? condition;
}

export function awardCriteriaLabel(dictionary: Dictionary, criteria: string): string {
  return (dictionary.awardCriteria as Record<string, string>)[criteria] ?? criteria;
}
