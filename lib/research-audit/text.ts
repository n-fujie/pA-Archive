import type { GroundRef } from "@/lib/ziran/types";

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/** Naive but offset-accurate sentence split. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const trimmed = raw.trim();
    if (trimmed.length < 2) continue;
    const start = m.index + raw.indexOf(trimmed);
    out.push({ text: trimmed, start, end: start + trimmed.length });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

/** Case-insensitive occurrences of a literal phrase, with offsets. */
export function findAll(text: string, phrase: string): { start: number; end: number }[] {
  const hits: { start: number; end: number }[] = [];
  if (!phrase) return hits;
  const hay = text.toLowerCase();
  const needle = phrase.toLowerCase();
  let i = hay.indexOf(needle);
  while (i !== -1) {
    hits.push({ start: i, end: i + needle.length });
    i = hay.indexOf(needle, i + needle.length);
  }
  return hits;
}

export function groundAround(text: string, start: number, end: number, pad = 120): GroundRef {
  const s = Math.max(0, start - pad);
  const e = Math.min(text.length, end + pad);
  return { charStart: start, charEnd: end, quote: text.slice(s, e).replace(/\s+/g, " ").trim() };
}

export function sentenceGround(text: string, sentence: Sentence): GroundRef {
  return { charStart: sentence.start, charEnd: sentence.end, quote: sentence.text.replace(/\s+/g, " ").trim() };
}
