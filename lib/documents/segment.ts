import type { DocumentSegmentKind } from "@prisma/client";

export interface Segment {
  kind: DocumentSegmentKind;
  label: string | null;
  order: number;
  charStart: number;
  charEnd: number;
  text: string;
  /** index into the segment array of the parent, if nested */
  parentIndex?: number;
}

// Headings we can map to a canonical section kind when the label matches.
const SECTION_HINTS: { re: RegExp; kind: DocumentSegmentKind }[] = [
  { re: /^\s*abstract\b/i, kind: "ABSTRACT" },
  { re: /^\s*(?:\d+\.?\s*)?(?:introduction|background)\b/i, kind: "SECTION" },
  { re: /^\s*(?:\d+\.?\s*)?(?:methods?|methodology|materials and methods|experimental setup)\b/i, kind: "METHOD" },
  { re: /^\s*(?:\d+\.?\s*)?results?\b/i, kind: "RESULT" },
  { re: /^\s*(?:\d+\.?\s*)?(?:discussion|analysis)\b/i, kind: "SECTION" },
  { re: /^\s*(?:\d+\.?\s*)?(?:conclusions?|concluding remarks|summary)\b/i, kind: "CONCLUSION" },
  { re: /^\s*(?:data|code)\s+availability\b/i, kind: "DATA_STATEMENT" },
  { re: /^\s*(?:references|bibliography|works cited|literature cited)\b/i, kind: "REFERENCE" },
];

const HEADING_RE =
  /^(?:#{1,6}\s+.+|(?:\d+(?:\.\d+)*\.?\s+)?[A-Z][A-Za-z0-9 ,:\-/()&]{2,80})$/;

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (t.startsWith("#")) return true;
  if (/[.!?;:,]$/.test(t) && !/:$/.test(t)) return false;
  if (t.split(/\s+/).length > 12) return false;
  // ALL CAPS short line, or Title Case starting with a capital, optionally numbered
  if (/^[0-9]+(\.[0-9]+)*\.?\s+\S/.test(t)) return true;
  if (/^[A-Z][A-Za-z].*$/.test(t) && HEADING_RE.test(t)) return true;
  return false;
}

function sectionKindFor(label: string): DocumentSegmentKind {
  for (const h of SECTION_HINTS) if (h.re.test(label)) return h.kind;
  return "SECTION";
}

/**
 * Identify the structure that is actually present. Conservative: text with no
 * recognisable headings yields a flat list of PARAGRAPH segments (plus a TITLE
 * guess only when the first line is short and heading-like).
 */
export function segmentText(text: string, kind: "pdf" | "docx" | "md" | "txt"): Segment[] {
  if (!text.trim()) return [];
  const segments: Segment[] = [];
  const lines = text.split("\n");
  let cursor = 0;
  let order = 0;
  let currentSectionIndex: number | undefined;

  // Title guess: first non-empty line, short, not ending in a period.
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx >= 0) {
    const first = lines[firstIdx].trim();
    if (first.length <= 200 && !/[.]$/.test(first) && firstIdx <= 3) {
      const start = text.indexOf(first, cursor);
      segments.push({
        kind: "TITLE",
        label: null,
        order: order++,
        charStart: start,
        charEnd: start + first.length,
        text: first,
      });
    }
  }

  // Walk lines, grouping paragraphs under the most recent heading.
  let paraBuf: string[] = [];
  let paraStart = -1;

  const flushPara = () => {
    const body = paraBuf.join("\n").trim();
    if (body.length >= 1 && paraStart >= 0) {
      const kindGuess: DocumentSegmentKind =
        /^(?:\[?\d+\]?[.)]\s+|\d+\.\s+[A-Z].+\(\d{4}\)|[A-Z][a-z]+,\s+[A-Z]\.)/.test(body) &&
        currentSectionIndex !== undefined &&
        segments[currentSectionIndex]?.kind === "REFERENCE"
          ? "CITATION"
          : "PARAGRAPH";
      segments.push({
        kind: kindGuess,
        label: null,
        order: order++,
        charStart: paraStart,
        charEnd: paraStart + body.length,
        text: body,
        parentIndex: currentSectionIndex,
      });
    }
    paraBuf = [];
    paraStart = -1;
  };

  let lineStart = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushPara();
    } else if (looksLikeHeading(line) && paraBuf.length === 0) {
      flushPara();
      const label = trimmed.replace(/^#{1,6}\s+/, "");
      const start = text.indexOf(trimmed, lineStart >= 0 ? lineStart : 0);
      segments.push({
        kind: sectionKindFor(label),
        label,
        order: order++,
        charStart: start,
        charEnd: start + trimmed.length,
        text: label,
      });
      currentSectionIndex = segments.length - 1;
    } else {
      if (paraStart < 0) paraStart = lineStart;
      paraBuf.push(line);
    }
    lineStart += line.length + 1;
  }
  flushPara();
  cursor = text.length;

  // Equation heuristic: promote paragraph-ish blocks that are mostly math.
  for (const s of segments) {
    if (s.kind === "PARAGRAPH" && /[=∑∫≈≤≥±→]/.test(s.text) && s.text.length < 200 && /\d/.test(s.text)) {
      s.kind = "EQUATION";
    }
  }

  return segments;
}
