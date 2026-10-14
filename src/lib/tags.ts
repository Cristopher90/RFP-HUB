// #tags written in free text (notes, an RFP's internal notes). A tag is "#"
// followed by letters, digits, "_" or "-"; it must not touch a word before it
// (so "a#b" and URLs with anchors are not tags). Matching ignores case.

export const MAX_TAGS = 20;

const tagRe = () => /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_-]{1,30})/gu;

// Unique tags of a text, lowercase, in order of appearance.
export function extractTags(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(tagRe())) {
    const tag = m[1].replace(/[-_]+$/, "").toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export type TagSegment = { type: "text"; text: string } | { type: "tag"; raw: string; tag: string };

// Splits a text into plain parts and tags (to render the tags apart).
export function splitTags(text: string): TagSegment[] {
  const out: TagSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(tagRe())) {
    const name = m[1].replace(/[-_]+$/, "");
    if (!name) continue;
    const start = m.index ?? 0;
    if (start > last) out.push({ type: "text", text: text.slice(last, start) });
    out.push({ type: "tag", raw: `#${name}`, tag: name.toLowerCase() });
    last = start + 1 + name.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}
