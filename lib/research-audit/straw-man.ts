import type { ParsedDocument } from "@/lib/documents/parse";
import {
  COMPARATIVE_SUPERIORITY_MARKERS,
  CRITICISM_MARKERS,
  HISTORICAL_DESCRIPTION_MARKERS,
  NEUTRAL_ATTRIBUTION_MARKERS,
  NEUTRAL_COMPARISON_MARKERS,
} from "./lexicon";

/**
 * Straw-Man Risk / Target-Understanding audit — shared target detection.
 *
 * Used by both the Ziran orchestrator (to decide whether stage 15 fires) and
 * the heuristic analyzer (to build one audit row per criticised target).
 *
 * The point of this stage is NOT to judge whether a criticism is right. It is
 * to check whether the target of the criticism was identified and reconstructed
 * with enough fidelity for the criticism to count as a *completed* criticism
 * rather than a potentially weak reconstruction of the target.
 *
 * Phase 2 is epistemically conservative: it separates
 *  - what material is *present* in the submitted document (mechanical), from
 *  - whether that material has been *verified* (it has not, in a zero-AI layer), from
 *  - the resulting *risk* that the reconstruction is too weak.
 * A citation is evidence that checking may have occurred; it is never evidence
 * that the checking was correct.
 */

export type StrawManTargetKind =
  | "PERSON"
  | "WORK"
  | "THEORY"
  | "MODEL"
  | "PROGRAMME"
  | "SCHOOL"
  | "ISM"
  | "OTHER";

/** Document-grounded temporal / version identity of a criticism target. */
export interface CriticismTargetIdentity {
  canonicalName: string;
  targetKind: StrawManTargetKind;
  workTitle?: string;
  publicationYear?: number;
  editionOrVersion?: string;
  periodLabel?: string;
  /** True when any of the above temporal/version fields was resolved from text. */
  explicitlyTemporal: boolean;
}

export interface TargetGround {
  role: string;
  charStart: number;
  charEnd: number;
  quote: string;
}

export interface CriticismTarget {
  /** Human-facing label (may include the period/work qualifier). */
  label: string;
  kind: StrawManTargetKind;
  identity: CriticismTargetIdentity;
  /**
   * false → the criticism is addressed to an undifferentiated name even though
   * the document arguably makes a version/period distinction available, OR no
   * temporal information exists at all. Callers should surface
   * TARGET_VERSION_UNRESOLVED.
   */
  versionResolved: boolean;
  /** True when a strong/universal claim is made about the bare name while only
   *  one phase/work is actually engaged — temporal overgeneralisation risk. */
  temporalOvergeneralisation: boolean;
  mentions: number;
  mentionOffsets: number[];
  charStart: number;
  charEnd: number;
  grounds: TargetGround[];
}

const STOPWORD_NAMES = new Set([
  "The", "This", "That", "These", "Those", "Their", "There", "Then", "Thus",
  "Here", "However", "Moreover", "Therefore", "Hence", "First", "Second",
  "Third", "Finally", "Table", "Figure", "Section", "Chapter", "Abstract",
  "Introduction", "Conclusion", "References", "We", "In", "On", "As", "It",
  "One", "Some", "Many", "Both", "Each", "For", "But", "And", "Not", "If",
  "While", "Although", "Because", "Since", "Given", "Consider", "Suppose",
  "Note", "See", "According", "Unlike", "Contra", "Early", "Late", "Later",
  "Recent", "Modern", "Classical", "Our", "Its", "Also",
]);

// A candidate proper name (1–3 capitalised tokens, optional nobiliary particle).
const NAME_RE =
  /\b([A-Z][a-z]{2,}(?:\s+(?:van|von|de|del|della|di|da|la|le|der)\s+[A-Z][a-z]{2,}|\s+[A-Z][a-z]{2,}){0,2})\b/g;

// Position verbs — an attribution signal that a name is a position-holder.
const POSITION_VERB_RE =
  /^[^.!?\n;]{0,40}?\b(argues?|argued|claims?|claimed|holds?|held|contends?|maintains?|maintained|assumes?|assumed|insists?|suggests?|proposes?|proposed|denies|denied|thinks?|believes?|posits?|treats?|takes?|writes?|wrote|says?|said|defines?|defined|conceives?|understands?|characteri[sz]es?|describes?|regards?|the\s+(?:view|account|theory|position|model|thesis|claim|argument|approach|framework|doctrine|programme|program|picture|conception))\b/i;

// "criticise X" / "against X" / "contra X" — the criticism points at the name.
const CRITICISM_VERB_BEFORE_RE =
  /\b(criticis\w*|critiqu\w*|reject\w*|against|contra|pace|attack\w*|target\w*|challeng\w*|dispute\w*|oppose\w*)\s+\W{0,3}$/i;

// Japanese: 「Xの理論／権力論」「Xは…と論じる／主張する」
const JP_NAME_OF_RE =
  /([゠-ヿ]{2,12}|[一-鿿]{2,5})(?:の)([一-鿿]{2,8}(?:論|説|理論|概念|モデル|批判|思想|体系))/g;
const JP_NAME_VERB_RE =
  /([゠-ヿ]{2,12}|[一-鿿]{2,5})(?:は|が)[^。]{0,40}?(と(?:論じ|主張|述べ|考え|想定)|を提唱|を主張)/g;

// "the X theory / the 1986 X model / the X programme / the X view …"
const NAMED_SYSTEM_RE =
  /\bthe\s+(?:\d{3,4}\s+)?([A-Z][A-Za-z-]+(?:\s+[A-Za-z-]+){0,3}?)\s+(theory|model|hypothesis|programme|program|framework|account|view|paradigm|school|approach|doctrine|thesis|picture|conception)\b/g;

// "-ism" schools / thought-systems: functionalism, physicalism, structuralism …
const ISM_RE = /\b([A-Z]?[a-z]{4,}ism)\b/g;

// "X's theory of Y" / "the theory of Y"
const THEORY_OF_RE =
  /\b(?:([A-Z][a-z]{2,})(?:'s|’s)\s+)?(?:the\s+)?(theory|account|model|doctrine|conception)\s+of\s+([a-z][A-Za-z-]+(?:\s+[a-z][A-Za-z-]+){0,2})\b/g;

// "early Foucault" / "the late Land" / "the mature Millikan"
const PERIOD_NAME_RE =
  /\b(?:the\s+)?(early|late|later|mature|young|middle|earlier)\s+([A-Z][a-z]{2,})\b/g;

const EDITION_RE =
  /\b(first|second|third|fourth|fifth|revised|new|original|1st|2nd|3rd)\s+(?:edition|version)\b|\bv(?:ersion)?\.?\s?([1-9])\b/i;

const YEAR_RE = /\b(1[6-9]\d{2}|20\d{2})\b/;

// A work title: a quoted span, a markdown-italic span, "in Title (YYYY)", or
// "in \"Title\"" / "in _Title_" directly after a name.
const QUOTED_TITLE_RE = /["“”„]([A-Z][^"“”\n]{2,70})["“”]/;
const ITALIC_TITLE_RE = /(?:^|\s)_([A-Z][^_\n]{2,70})_/;
const IN_WORK_RE =
  /\bin\s+(?:["“]([^"”\n]{3,60})["”]|_([^_\n]{3,60})_|([A-Z][\w''-]+(?:\s+(?:and|of|the|a|an|[A-Z][\w''-]+)){0,6})\s+\((?:1[6-9]\d{2}|20\d{2})\))/;
// "in his/her/its early work", "originally", "the young X" — an early-phase cue.
const EARLY_PHASE_RE = /\b(?:in\s+(?:his|her|their|its)\s+early\s+\w+|early\s+(?:work|writings?|period|phase)|originally|initially|the\s+young)\b/i;
const LATE_PHASE_RE = /\b(?:in\s+(?:his|her|their|its)\s+(?:later|late|mature)\s+\w+|later\s+(?:work|writings?|period|phase)|the\s+mature\b|the\s+late\b)/i;

function classify(descriptor: string): StrawManTargetKind {
  const d = descriptor.toLowerCase();
  if (/(programme|program)$/.test(d)) return "PROGRAMME";
  if (/school$/.test(d)) return "SCHOOL";
  if (/model|picture$/.test(d)) return "MODEL";
  if (/ism$/.test(d)) return "ISM";
  if (/(theory|hypothesis|account|view|paradigm|doctrine|thesis|framework|approach|conception)$/.test(d))
    return "THEORY";
  return "OTHER";
}

/** Evaluative-criticism / comparative-superiority markers only (never neutral). */
const EVALUATIVE_MARKERS = [...CRITICISM_MARKERS, ...COMPARATIVE_SUPERIORITY_MARKERS];

function countAny(lowerText: string, markers: string[]): number {
  let n = 0;
  for (const mk of markers) {
    const needle = mk.toLowerCase().trim();
    if (!needle) continue;
    let i = lowerText.indexOf(needle);
    while (i !== -1) {
      n += 1;
      i = lowerText.indexOf(needle, i + needle.length);
    }
  }
  return n;
}

function nearestMarkerDistance(lowerText: string, at: number, markers = EVALUATIVE_MARKERS): number {
  let best = Number.POSITIVE_INFINITY;
  for (const mk of markers) {
    const needle = mk.toLowerCase().trim();
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

export interface CriticismSignals {
  criticismCount: number;
  comparativeSuperiorityCount: number;
  /** True when the only name-adjacent language is neutral comparison / attribution
   *  / historical description — the audit must not fire on this alone. */
  neutralOnly: boolean;
}

/** Mechanical read of whether the document criticises (vs merely uses / compares). */
export function analyzeCriticismSignals(doc: ParsedDocument): CriticismSignals {
  const lower = doc.text.toLowerCase();
  const criticismCount = countAny(lower, CRITICISM_MARKERS);
  const comparativeSuperiorityCount = countAny(lower, COMPARATIVE_SUPERIORITY_MARKERS);
  const neutral =
    countAny(lower, NEUTRAL_COMPARISON_MARKERS) +
    countAny(lower, NEUTRAL_ATTRIBUTION_MARKERS) +
    countAny(lower, HISTORICAL_DESCRIPTION_MARKERS);
  return {
    criticismCount,
    comparativeSuperiorityCount,
    neutralOnly: criticismCount === 0 && comparativeSuperiorityCount === 0 && neutral > 0,
  };
}

interface RawEntry {
  kind: StrawManTargetKind;
  offsets: number[];
  display: string;
  canonical: string;
}

function readIdentityAt(
  text: string,
  _lower: string,
  at: number,
  canonical: string,
  kind: StrawManTargetKind,
): { identity: CriticismTargetIdentity; grounds: TargetGround[] } {
  // Version / work / period cues must be *tightly* bound to THIS mention, or
  // they bleed across mentions of the same name. Leading window ≈ 46 chars
  // (for "in his early work, X" / "early X"); trailing window stops at the
  // sentence end (for "X in <Work>" / "X (1993)" / "X, revised edition").
  const leadStart = Math.max(0, at - 46);
  const leading = text.slice(leadStart, at);
  const sentEnd = (() => {
    const rel = text.slice(at + canonical.length, at + canonical.length + 180).search(/[.!?。\n]/);
    return at + canonical.length + (rel === -1 ? 120 : Math.min(rel + 1, 120));
  })();
  const trailing = text.slice(at, sentEnd);
  const grounds: TargetGround[] = [];
  const pushFrom = (role: string, base: number, hay: string, frag: string) => {
    const i = hay.indexOf(frag);
    if (i < 0) return;
    grounds.push({ role, charStart: base + i, charEnd: base + i + frag.length, quote: frag.trim().slice(0, 120) });
  };

  const firstName = canonical.split(/\s+/)[0].toLowerCase();
  let periodLabel: string | undefined;
  PERIOD_NAME_RE.lastIndex = 0;
  let pm: RegExpExecArray | null;
  const both = `${leading} ${trailing}`;
  while ((pm = PERIOD_NAME_RE.exec(both))) {
    if (pm[2].toLowerCase() === firstName) {
      periodLabel = pm[1].toLowerCase();
      pushFrom("temporal-qualification", leadStart, leading, pm[0]);
      break;
    }
  }
  if (!periodLabel) {
    const early = leading.match(EARLY_PHASE_RE) || trailing.match(EARLY_PHASE_RE);
    const late = leading.match(LATE_PHASE_RE) || trailing.match(LATE_PHASE_RE);
    if (early) {
      periodLabel = "early";
      pushFrom("temporal-qualification", leadStart, both, early[0]);
    } else if (late) {
      periodLabel = "late";
      pushFrom("temporal-qualification", leadStart, both, late[0]);
    }
  }

  let publicationYear: number | undefined;
  const ym = trailing.slice(0, 40).match(YEAR_RE) || leading.match(/,\s*(1[6-9]\d{2}|20\d{2})\b/);
  if (ym) {
    publicationYear = Number(ym[1] ?? ym[0]);
    pushFrom("publication-year", at, trailing, String(publicationYear));
  }

  let editionOrVersion: string | undefined;
  const em = trailing.slice(0, 60).match(EDITION_RE);
  if (em) {
    editionOrVersion = em[0].trim();
    pushFrom("work-version-marker", at, trailing, em[0]);
  }

  let workTitle: string | undefined;
  const iw = trailing.match(IN_WORK_RE);
  const qt = trailing.slice(0, 24).match(QUOTED_TITLE_RE) || trailing.slice(0, 24).match(ITALIC_TITLE_RE);
  const wm = iw || qt;
  if (wm) {
    workTitle = (iw ? iw[1] || iw[2] || iw[3] : wm[1]).trim();
    pushFrom("work-version-marker", at, trailing, wm[0]);
  }

  const explicitlyTemporal = Boolean(periodLabel || publicationYear || editionOrVersion || workTitle);

  return {
    identity: {
      canonicalName: canonical,
      targetKind: kind,
      workTitle,
      publicationYear,
      editionOrVersion,
      periodLabel,
      explicitlyTemporal,
    },
    grounds,
  };
}

/** A "strong / universal" statement about the bare name (Foucault *is* …, X always …).
 *  Deliberately excludes bare possessive ("X's account"), which is merely attributive. */
function hasUniversalClaimAbout(lower: string, canonical: string): boolean {
  const n = canonical.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\b${n}\\b(?:\\s+(?:is|are|always|never|everywhere|throughout|in general|as such|ultimately|fundamentally|simply|invariably|consistently|treats?\\s+\\w+\\s+as))\\b`,
    "i",
  );
  return re.test(lower);
}

/**
 * Detect the specific persons / works / theories / models / programmes / schools
 * / -isms that the document criticises, with document-grounded version identity.
 */
export function detectCriticismTargets(doc: ParsedDocument): CriticismTarget[] {
  const text = doc.text;
  const lower = text.toLowerCase();
  const byLabel = new Map<string, RawEntry>();

  const add = (rawLabel: string, kind: StrawManTargetKind, at: number, canonical?: string) => {
    const label = rawLabel.replace(/\s+/g, " ").trim().replace(/['’]s$/, "");
    if (label.length < 3 || label.length > 80) return;
    const firstWord = label.split(/\s+/)[0];
    if (STOPWORD_NAMES.has(firstWord)) return;
    const key = label.toLowerCase();
    const entry =
      byLabel.get(key) ?? { kind, offsets: [], display: label, canonical: canonical ?? label };
    entry.offsets.push(at);
    if (entry.kind === "OTHER" && kind !== "OTHER") entry.kind = kind;
    byLabel.set(key, entry);
  };

  let m: RegExpExecArray | null;

  // quoted / italic spans hold work titles, not person names
  const quotedSpans: [number, number][] = [];
  for (const re of [/["“”„][^"“”\n]{2,90}["“”]/g, /(?:^|\s)_[^_\n]{2,90}_/g]) {
    let qm: RegExpExecArray | null;
    while ((qm = re.exec(text))) quotedSpans.push([qm.index, qm.index + qm[0].length]);
  }
  const insideQuoted = (i: number) => quotedSpans.some(([a, b]) => i >= a && i < b);

  // --- persons: a capitalised name near an evaluative marker that also carries
  //     an attribution signal (a position verb after it, a possessive, a
  //     "criticise X" verb before it, an "in <Work>" clause, or a "(YYYY)"). ---
  NAME_RE.lastIndex = 0;
  while ((m = NAME_RE.exec(text))) {
    const name = m[1];
    const start = m.index;
    const end = start + m[0].length;
    if (STOPWORD_NAMES.has(name.split(/\s+/)[0])) continue;
    if (insideQuoted(start)) continue;
    if (nearestMarkerDistance(lower, start) > PROXIMITY) continue;
    const after = text.slice(end, end + 60);
    const before = text.slice(Math.max(0, start - 24), start);
    const before80 = text.slice(Math.max(0, start - 80), start).toLowerCase();
    // "nothing … turns on criticising X", "we do not criticise X", "rather than
    // criticising X" — a negated criticism verb is not an attribution.
    const negatedCriticism =
      CRITICISM_VERB_BEFORE_RE.test(before) &&
      /\b(not|n['’]t|nothing|never|without|rather than|no need to|does not|do not)\b[^.?!]*$/.test(before80);
    const attributed =
      POSITION_VERB_RE.test(after) ||
      /^['’]s\b/.test(after) ||
      /^\s*\((?:1[6-9]\d{2}|20\d{2})\)/.test(after) ||
      /^\s+in\s+["“_A-Z]/.test(after) ||
      (CRITICISM_VERB_BEFORE_RE.test(before) && !negatedCriticism);
    if (!attributed) continue;
    add(name, "PERSON", start);
  }

  // Japanese targets: 「Xの理論／権力論」→ THEORY;  「Xは…と論じる」→ PERSON
  JP_NAME_OF_RE.lastIndex = 0;
  while ((m = JP_NAME_OF_RE.exec(text))) {
    if (nearestMarkerDistance(lower, m.index) <= PROXIMITY)
      add(`${m[1]}の${m[2]}`, /論|説|理論|モデル|体系/.test(m[2]) ? "THEORY" : "OTHER", m.index, m[1]);
  }
  JP_NAME_VERB_RE.lastIndex = 0;
  while ((m = JP_NAME_VERB_RE.exec(text))) {
    if (nearestMarkerDistance(lower, m.index) <= PROXIMITY) add(m[1], "PERSON", m.index);
  }

  NAMED_SYSTEM_RE.lastIndex = 0;
  while ((m = NAMED_SYSTEM_RE.exec(text))) {
    if (nearestMarkerDistance(lower, m.index) <= PROXIMITY)
      add(`${m[1]} ${m[2]}`, classify(m[2]), m.index);
  }

  // "unlike / goes beyond / improves on the <lowercase> X account" — the object
  // of a comparative-superiority claim IS a criticism target even without a
  // proper-noun head.
  const COMPARED_SYSTEM_RE =
    /\b(?:unlike|goes?\s+beyond|improves?\s+(?:on|upon)|surpass\w*|better\s+than|more\s+adequate\s+than|overcomes?\s+the\s+limitations\s+of|removes?\s+the\s+need\s+for)\s+(?:the\s+)?([a-z][\w-]+(?:[\s-][\w-]+){0,3}?)\s+(account|view|model|approach|theory|framework|paradigm|picture|hypothesis)\b/gi;
  let cm: RegExpExecArray | null;
  while ((cm = COMPARED_SYSTEM_RE.exec(text))) {
    add(`the ${cm[1]} ${cm[2]}`.replace(/\s+/g, " "), classify(cm[2]), cm.index);
  }

  ISM_RE.lastIndex = 0;
  while ((m = ISM_RE.exec(text))) {
    const ownerM = text.slice(Math.max(0, m.index - 20), m.index).match(/([A-Z][a-z]{2,})['’]s\s+$/);
    if (ownerM) add(`${ownerM[1]}'s ${m[1]}`, "ISM", m.index, ownerM[1]);
    else add(m[1], "ISM", m.index);
  }

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
    add(`${owner}${m[2]} of ${m[3]}`, "THEORY", m.index, m[1] || undefined);
  }

  // --- build targets, splitting a canonical name across distinct periods/works -
  let targets: CriticismTarget[] = [];

  for (const [key, entry] of byLabel) {
    const mentions = entry.offsets.length;
    if (entry.kind === "ISM" && mentions < 2) {
      const near = entry.offsets.some((o) => nearestMarkerDistance(lower, o) <= PROXIMITY);
      if (!near) continue;
    }

    // identity per mention
    const perMention = entry.offsets.map((o) => ({
      offset: o,
      ...readIdentityAt(text, lower, o, entry.canonical, entry.kind),
    }));

    // group by a version signature (period|work|edition|year)
    const groups = new Map<string, typeof perMention>();
    for (const pm of perMention) {
      const id = pm.identity;
      const sig = [
        id.periodLabel ?? "",
        id.workTitle ?? "",
        id.editionOrVersion ?? "",
        id.publicationYear ?? "",
      ].join("|");
      const arr = groups.get(sig) ?? [];
      arr.push(pm);
      groups.set(sig, arr);
    }

    const distinctVersioned = [...groups.entries()].filter(([sig]) => sig !== "|||");
    const universal = hasUniversalClaimAbout(lower, entry.canonical);

    const mkTarget = (
      items: typeof perMention,
      labelSuffix: string,
      identity: CriticismTargetIdentity,
      versionResolved: boolean,
      overGen: boolean,
    ): CriticismTarget => {
      const offsets = items.map((i) => i.offset).sort((a, b) => a - b);
      const grounds = items.flatMap((i) => i.grounds);
      grounds.push({
        role: "target-mention",
        charStart: offsets[0],
        charEnd: Math.min(text.length, offsets[0] + entry.canonical.length),
        quote: text.slice(offsets[0], Math.min(text.length, offsets[0] + 80)).replace(/\s+/g, " ").trim(),
      });
      return {
        label: (labelSuffix ? `${labelSuffix} ` : "") + entry.display,
        kind: entry.kind,
        identity,
        versionResolved,
        temporalOvergeneralisation: overGen,
        mentions: items.length,
        mentionOffsets: offsets,
        charStart: offsets[0],
        charEnd: Math.min(text.length, offsets[0] + entry.canonical.length),
        grounds: dedupeGrounds(grounds),
      };
    };

    if (distinctVersioned.length >= 2) {
      // genuinely different phases / works are engaged — keep them separate
      for (const [, items] of distinctVersioned) {
        const id = items[0].identity;
        const suffix = id.periodLabel
          ? id.periodLabel
          : id.workTitle
            ? `in ${id.workTitle} —`
            : id.editionOrVersion
              ? `(${id.editionOrVersion})`
              : "";
        targets.push(mkTarget(items, suffix, id, true, false));
      }
      // any bare mentions plus a universal claim → an overgeneralisation row
      const bare = groups.get("|||");
      if (bare && universal) {
        targets.push(
          mkTarget(
            bare,
            "",
            { canonicalName: entry.canonical, targetKind: entry.kind, explicitlyTemporal: false },
            false,
            true,
          ),
        );
      }
    } else if (distinctVersioned.length === 1) {
      const [, items] = distinctVersioned[0];
      const id = items[0].identity;
      const bare = groups.get("|||") ?? [];
      const merged = [...items, ...bare];
      // one phase engaged; if a universal claim is also made about the bare name,
      // the criticism may overgeneralise from that single phase.
      targets.push(mkTarget(merged, id.periodLabel ?? "", id, true, universal && bare.length > 0));
    } else {
      // no temporal information anywhere
      targets.push(
        mkTarget(
          perMention,
          "",
          { canonicalName: entry.canonical, targetKind: entry.kind, explicitlyTemporal: false },
          false,
          false,
        ),
      );
    }
  }

  // Consolidate a bare PERSON into a richer target that names the SAME person
  // (an "-ism" / theory / model / work they own), UNLESS the richer target
  // carries a distinct period/work identity the bare mention lacks (that would be
  // cross-version contamination — keep them separate then).
  const persons = targets.filter((t) => t.kind === "PERSON" && !/\s/.test(t.identity.canonicalName));
  for (const p of persons) {
    const owner = p.identity.canonicalName.toLowerCase();
    const richer = targets.find(
      (t) =>
        t !== p &&
        t.kind !== "PERSON" &&
        (t.identity.canonicalName.toLowerCase() === owner ||
          t.label.toLowerCase().includes(`${owner}'s `) ||
          t.label.toLowerCase().startsWith(`${owner} `)),
    );
    const contamination =
      richer &&
      ((richer.identity.periodLabel && !p.identity.periodLabel) ||
        (richer.identity.workTitle && !p.identity.workTitle));
    if (richer && !contamination) {
      richer.mentions += p.mentions;
      richer.mentionOffsets = [...new Set([...richer.mentionOffsets, ...p.mentionOffsets])].sort((a, b) => a - b);
      richer.charStart = Math.min(richer.charStart, p.charStart);
      richer.temporalOvergeneralisation = richer.temporalOvergeneralisation || p.temporalOvergeneralisation;
      richer.grounds = dedupeGrounds([...richer.grounds, ...p.grounds]);
      targets = targets.filter((t) => t !== p);
    }
  }

  targets.sort((a, b) => b.mentions - a.mentions || a.charStart - b.charStart);
  return targets.slice(0, 6);
}

function dedupeGrounds(g: TargetGround[]): TargetGround[] {
  const seen = new Set<string>();
  const out: TargetGround[] = [];
  for (const x of g) {
    const k = `${x.role}:${x.charStart}:${x.charEnd}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}
