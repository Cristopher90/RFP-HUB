// Automatic scoring config for SELECT/NUMBER/YES_NO questions, stored as
// RfpQuestion.scoringConfig / TemplateQuestion.scoringConfig (JSON string).
// Shape is always a flat Record<string, number> so one editor component
// covers all three question types:
//   - SELECT / YES_NO: { [answerText]: percent (0-100) }
//   - NUMBER: { referenceValue: number } — the value that equals 100%
// A question with no config (or an unscored answer) keeps the existing
// manual buyer-scoring flow (Answer.score stays null until scored by hand).
export type ScoringConfig = Record<string, number>;

export const NUMBER_REFERENCE_KEY = "referenceValue";

export function parseScoringConfig(raw: string | null): ScoringConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as ScoringConfig;
  } catch {
    return null;
  }
}

export function serializeScoringConfig(config: ScoringConfig | null): string | null {
  if (!config) return null;
  const entries = Object.entries(config).filter(
    ([, v]) => typeof v === "number" && !Number.isNaN(v),
  );
  return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : null;
}

// Answer.score is stored 0-10 (same scale the manual buyer-scoring dropdown
// already uses in AwardPanel), so an auto-computed score plugs directly
// into the existing weighted-average pipeline with no further conversion.
export function computeAutoScore(
  type: string,
  raw: string | null,
  value: string,
): number | null {
  const config = parseScoringConfig(raw);
  if (!config) return null;

  if (type === "SELECT" || type === "YES_NO") {
    const percent = config[value];
    if (typeof percent !== "number" || Number.isNaN(percent)) return null;
    return Math.round(Math.min(100, Math.max(0, percent)) / 10);
  }

  if (type === "NUMBER") {
    const reference = config[NUMBER_REFERENCE_KEY];
    const numeric = Number(value);
    if (typeof reference !== "number" || reference <= 0 || Number.isNaN(numeric)) {
      return null;
    }
    const pct = Math.min(1, Math.max(0, numeric / reference)) * 100;
    return Math.round(pct / 10);
  }

  return null;
}
