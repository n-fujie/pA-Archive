import type { ParsedDocument } from "@/lib/documents/parse";
import {
  CRITICISM_MARKERS,
  COMPARATIVE_SUPERIORITY_MARKERS,
} from "./lexicon";

/**
 * Straw-Man Risk / Target-Understanding audit — shared target detection.
 *
 * Used by both the Ziran orchestrator (to decide whether stage 15 fires) and
 * the heuristic analyzer (to build one audit row per criticised target).
 *
 * The point of this stage is NOT to judge whether a criticism is right. It is
 * to check whether the target of the criticism was reconstructed at its
 * strongest — with its own limiting conditions, exceptions, self-corrections
 * and later revisions — BEFORE being criticised.
 */

export type StrawManTargetKind =
  | "PERSON"
  | "THEORY"
  | "SCHOOL"
  | "THOUGHT_SYSTEM"
  | "SCIENTIFIC_MODEL"
  | "RESEARCH_PROGRAMME"
  | "OTHER";

export interface CriticismTarget {
  label: string;
  kind: StrawManTargetKind;
  /** Number of times a surface form of this target occurs. */
  mentions: number;
  /** First occurrence offset (into doc.text). */
  charStart: number;
  charEnd: number;
}

const STOPWORD_NAMES = new Set([
  "The", "This", "That", "These", "Those", "Their", "There", "Then", "Thus",
  "Here", "However", "Moreover", "Therefore", "Hence", "First", "Second",
  "Third", "Finally", "Table", "Figure", "Section", "Chapter", "Abstract",
  "Introduction", "Conclusion", "References", "We", "In", "On", "As", "It",
  "One", "Some", "Many", "Both", "Each", "For", "But", "And", "Not", "If",
  "While", "Although", "Because", "Since", "Given", "Consider", "Suppose",
  "Note", "See", "According", "Unlike", "Contra",
]);

// "X argues / X's account / X holds that …" — a named position-holder.
const PERSON_RE =
  /\b([A-Z][a-z]{2,}(?:\s+(?:van|von|de|del|della|di|da|la|le)\s+[A-Z][a-z]{2,}|\s+[A-Z][a-z]{2,}){0,2})(?:'s|’s)?\s+(?:argues?|argued|claims?|claimed|holds?|held|contends?|maintains?|maintained|assumes?|assumed|insists?|suggests?|proposes?|proposed|denies|denied|thinks?|believes?|posits?|the\s+view|the\s+account|the\s+theory|the\s+position|the\s+model|the\s+thesis|the\s+claim|the\s+argument|the\s+approach|the\s+framework|the\s+doctrine|the\s+programme|the\s+program)\b/g;

// "the X theory / the X model / the X programme / the X school / the X view …"
const NAMED_SYSTEM_RE =
  /\bthe\s+([A-Z][A-Za-z-]+(?:\s+[A-Za-z-]+){0,3}?)\s+(theory|model|hypothesis|programme|program|framework|account|view|paradigm|school|approach|doctrine|thesis|picture|conception)\b/g;

// "-ism" schools / thought-systems: functionalism, physicalism, structuralism …
const ISM_RE = /\b([A-Z]?[a-z]{4,}ism)\b/g;

// "X's theory of Y" / "the theory of Y"
const THEORY_OF_RE =
  /\b(?:([A-Z][a-z]{2,})(?:'s|’s)\s+)?(?:the\s+)?(theory|account|model|doctrine|conception)\s+of\s+([a-z][A-Za-z-]+(?:\s+[a-z][A-Za-z-]+){0,2})\b/g;

function classify(descriptor: string): StrawManTargetKind {
  const d = descriptor.toLowerCase();
  if (/(programme|program)$/.test(d)) return "RESEARCH_PROGRAMME";
  if (/school$/.test(d)) return "SCHOOL";
  if (/model|picture$/.test(d)) return "SCIENTIFIC_MODEL";
  if (/ism$/.test(d)) return "THOUGHT_SYSTEM";
  if (/(theory|hypothesis|account|view|paradigm|doctrine|thesis|framework|approach|conception)$/.test(d))
    return "THEORY";
  return "OTHER";
}

function nearestMarkerDistance(lowerText: string, at: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const m of [...CRITICISM_MARKERS, ...COMPARATIVE_SUPERIORITY_MARKERS]) {
    const needle = m.toLowerCase().trim();
    if (!needle) continue;
    let i = lowerText.indexOf(needle);
    while (i !== -1) {
      best = Math.min(best, Math.abs(i - at));
      if (best === 0) return 0;
      i = lowerText.indexOf(needle, i + needle.length);
    }
  }
  return best;
}

/** Proximity (chars) within which a candidate must sit next to a criticism marker. */
const PROXIMITY = 600;

/**
 * Detect the specific persons / theories / schools / thought-systems /
 * scientific models / research programmes that the document criticises.
 *
 * Conservative: a candidate is kept only when a criticism or
 * comparative-superiority marker occurs within PROXIMITY characters of one of
 * its mentions (an "-ism" is kept if it appears anywhere, since naming a
 * thought-system in a critical paper is itself the signal).
 */
export function detectCriticismTargets(doc: ParsedDocument): CriticismTarget[] {
  const text = doc.text;
  const lower = text.toLowerCase();
  const byLabel = new Map<
    string,
    { kind: StrawManTargetKind; offsets: number[] }
  >();

  const display = new Map<string, string>();

  const add = (rawLabel: string, kind: StrawManTargetKind, at: number) => {
    const label = rawLabel.replace(/\s+/g, " ").trim().replace(/['’]s$/, "");
    if (label.length < 3 || label.length > 80) return;
    const firstWord = label.split(/\s+/)[0];
    if (STOPWORD_NAMES.has(firstWord)) return;
    const key = label.toLowerCase();
    const entry = byLabel.get(key) ?? { kind, offsets: [] };
    entry.offsets.push(at);
    // prefer a more specific kind over OTHER
    if (entry.kind === "OTHER" && kind !== "OTHER") entry.kind = kind;
    byLabel.set(key, entry);
    if (!display.has(key)) display.set(key, label);
  };

  let m: RegExpExecArray | null;

  PERSON_RE.lastIndex = 0;
  while ((m = PERSON_RE.exec(text))) {
    if (nearestMarkerDistance(lower, m.index) <= PROXIMITY) add(m[1], "PERSON", m.index);
  }

  NAMED_SYSTEM_RE.lastIndex = 0;
  while ((m = NAMED_SYSTEM_RE.exec(text))) {
    if (nearestMarkerDistance(lower, m.index) <= PROXIMITY)
      add(`${m[1]} ${m[2]}`, classify(m[2]), m.index);
  }

  ISM_RE.lastIndex = 0;
  while ((m = ISM_RE.exec(text))) {
    // "-ism" tokens are common; keep only those that recur or sit near a marker.
    add(m[1], "THOUGHT_SYSTEM", m.index);
  }

  // "X's theory of Y" — a generic ownerless object is too weak to stand alone.
  const GENERIC_OBJECTS = new Set([
    "perception", "cognition", "mind", "consciousness", "knowledge", "meaning",
    "truth", "reference", "action", "function", "language", "reality", "everything",
    "science", "explanation", "causation", "time", "space", "experience",
  ]);
  THEORY_OF_RE.lastIndex = 0;
  while ((m = THEORY_OF_RE.exec(text))) {
    if (nearestMarkerDistance(lower, m.index) > PROXIMITY) continue;
    if (!m[1] && GENERIC_OBJECTS.has(m[3].toLowerCase())) continue;
    const owner = m[1] ? `${m[1]}'s ` : "";
    add(`${owner}${m[2]} of ${m[3]}`, "THEORY", m.index);
  }

  let targets: CriticismTarget[] = [];
  for (const [key, entry] of byLabel) {
    const mentions = entry.offsets.length;
    // an -ism appearing exactly once and never near a marker is too weak
    if (entry.kind === "THOUGHT_SYSTEM" && mentions < 2) {
      const near = entry.offsets.some((o) => nearestMarkerDistance(lower, o) <= PROXIMITY);
      if (!near) continue;
    }
    const first = Math.min(...entry.offsets);
    targets.push({
      label: display.get(key) ?? key,
      kind: entry.kind,
      mentions,
      charStart: first,
      charEnd: Math.min(text.length, first + key.length),
    });
  }

  // Consolidate: a bare person name that also appears as the owner of a more
  // specific "<Person>'s <theory/model> …" target is folded into that target
  // (its mentions are added, and it is dropped as a standalone row).
  const persons = targets.filter((t) => t.kind === "PERSON" && !/\s/.test(t.label));
  for (const p of persons) {
    const owner = p.label.toLowerCase();
    const richer = targets.find(
      (t) => t !== p && t.label.toLowerCase().startsWith(`${owner}'s `),
    );
    if (richer) {
      richer.mentions += p.mentions;
      richer.charStart = Math.min(richer.charStart, p.charStart);
      targets = targets.filter((t) => t !== p);
    }
  }

  // Most-mentioned first; a criticism paper's real target is usually recurrent.
  targets.sort((a, b) => b.mentions - a.mentions || a.charStart - b.charStart);
  return targets.slice(0, 6);
}
