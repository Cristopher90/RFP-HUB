// Stable per-row identifier used only in-memory (forms) and in the create/
// save payload to let one question reference another (dependsOnQuestionKey)
// regardless of which array it's in or how the lists get reordered. Never
// persisted — the server resolves it to a real database id on save.
export function makeClientKey() {
  return crypto.randomUUID();
}
