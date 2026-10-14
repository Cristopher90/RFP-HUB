// @mentions inside notes: "@RFP-123" (an RFP by its number), "@DOC-4500012345"
// (a purchase request by document number) and "@PRV-90001" (a supplier by
// code). The text stays plain; each viewer's mentions are resolved to links
// when the note is shown, so a link only appears for what that viewer may open.

export type MentionKind = "RFP" | "DOC" | "PRV";

export type Mention = { href: string; title: string };

export type MentionSegment =
  | { type: "text"; text: string }
  | { type: "mention"; kind: MentionKind; id: string; raw: string };

const mentionRe = () => /(?<![\w])@(RFP|DOC|PRV)-([A-Za-z0-9][A-Za-z0-9._/-]*)/gi;

// Ids a mention can carry (anything else could not be told apart from the text around it).
export const MENTIONABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function mentionKey(kind: string, id: string) {
  return `${kind}-${id}`.toLowerCase();
}

export function splitMentions(text: string): MentionSegment[] {
  const out: MentionSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(mentionRe())) {
    // Trailing punctuation belongs to the sentence, not to the id.
    const id = m[2].replace(/[._/-]+$/, "");
    const raw = `@${m[1]}-${id}`;
    const start = m.index ?? 0;
    if (start > last) out.push({ type: "text", text: text.slice(last, start) });
    out.push({ type: "mention", kind: m[1].toUpperCase() as MentionKind, id, raw });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}
