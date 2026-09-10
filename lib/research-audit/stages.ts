import type { AuditStage } from "@prisma/client";
import type { AuditAnalyzer, AnalyzerContext } from "./analyzer";
import type { StageOutput, GroundRef } from "@/lib/ziran/types";
import { splitSentences, findAll, groundAround, sentenceGround } from "./text";
import {
  ADDRESS_MARKERS,
  BOUNDARY_MARKERS,
  CANDIDATE_CATEGORIES,
  CHARITABLE_READING_MARKERS,
  CLAIM_MARKERS,
  CONTEXT_CUT_MARKERS,
  CRITIC_CATEGORY_PROJECTION_MARKERS,
  CRITICISM_MARKERS,
  FALSIFIABILITY_MARKERS,
  HISTORY_MARKERS,
  OUTDATED_VERSION_MARKERS,
  PERIPHERAL_STATEMENT_MARKERS,
  SCALE_MARKERS,
  SECONDARY_SOURCE_MARKERS,
  SELF_REVISION_METHODOLOGY_MARKERS,
  SIMULATION_MARKERS,
  TARGET_DOES_NOT_CONSIDER_PATTERNS,
  TARGET_REVISION_MARKERS,
  THEORY_MINE_PATTERNS,
  TRANSITION_MARKERS,
  TRANSLATION_MARKERS,
} from "./lexicon";
import { detectCriticismTargets } from "./straw-man";
import { configurationCsb } from "@/lib/ziran/vocabulary";

const DEFINITION_MARKERS = [
  "we define", "is defined as", "we take … to mean", "by which we mean",
  "in this paper,", "we use the term", "we understand", "conditions for",
  "counts as", "we operationalise", "we operationalize", "we treat",
];

function segmentIdAt(ctx: AnalyzerContext, charStart: number): string | undefined {
  let best: number | undefined;
  ctx.doc.segments.forEach((s, i) => {
    if (charStart >= s.charStart && charStart <= s.charEnd) best = i;
  });
  return best !== undefined ? ctx.segmentIds[best] : undefined;
}

export class HeuristicAnalyzer implements AuditAnalyzer {
  readonly name = "heuristic-v1";

  supports(): boolean {
    return true; // implements every stage deterministically
  }

  async analyze(stage: AuditStage, ctx: AnalyzerContext): Promise<StageOutput> {
    switch (stage) {
      case "STRUCTURE": return this.structure(ctx);
      case "CATEGORIES": return this.categories(ctx);
      case "CATEGORY_IGNITION": return this.categoryIgnition(ctx);
      case "WEAK_OPERATIONAL": return this.weakOperational(ctx);
      case "TRANSITION": return this.transition(ctx);
      case "HISTORY_REINJECTION": return this.historyReinjection(ctx);
      case "BOUNDARY_SCALE": return this.boundaryScale(ctx);
      case "ADDRESS_DOMAIN": return this.address(ctx);
      case "CLAIM_EVIDENCE": return this.claimEvidence(ctx);
      case "DOI_REVIEW": return this.doiReview(ctx);
      case "SIMULATION": return this.simulation(ctx);
      case "COUNTERFACTUAL": return this.counterfactual(ctx);
      case "THEORY_MINE": return this.theoryMine(ctx);
      case "REGRESSION": return this.regression(ctx);
      case "STRAW_MAN_RISK": return this.strawManRisk(ctx);
      case "REPORT": return { }; // assembled by the pipeline
      default: return {};
    }
  }

  // 1 -----------------------------------------------------------------------
  private structure(ctx: AnalyzerContext): StageOutput {
    const kinds = new Map<string, number>();
    for (const s of ctx.doc.segments) kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1);
    const summary = `Identified ${ctx.doc.segments.length} segment(s): ${[...kinds.entries()].map(([k, n]) => `${n}×${k.toLowerCase()}`).join(", ") || "none"}.`;
    const missing = ["ABSTRACT", "METHOD", "RESULT", "CONCLUSION", "REFERENCE"].filter((k) => !kinds.has(k));
    return {
      findings: [
        {
          kind: "STRUCTURE_SUMMARY",
          summary,
          detail:
            missing.length > 0
              ? `No segment was identified for: ${missing.map((m) => m.toLowerCase()).join(", ")}. These were not generated — the document may not contain them, or the parser could not recognise the headings.`
              : "All common section kinds were identifiable.",
          source: "DOCUMENT",
          groundRefs: ctx.doc.segments.slice(0, 1).map((s) => ({ segmentId: ctx.segmentIds[0], charStart: s.charStart, charEnd: s.charEnd, quote: s.text.slice(0, 200) })),
          uncertaintyText: "Structure recognition is heuristic; a segment kind of OTHER means the parser saw a heading it could not classify.",
        },
      ],
    };
  }

  // 2 -----------------------------------------------------------------------
  private categories(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const lower = text.toLowerCase();
    const rows: unknown[] = [];
    for (const cand of CANDIDATE_CATEGORIES) {
      const forms = cand.forms.filter((f) => lower.includes(f));
      if (forms.length === 0) continue;
      const firstHit = forms
        .flatMap((f) => findAll(text, f))
        .sort((a, b) => a.start - b.start)[0];
      if (!firstHit) continue;
      const window = lower.slice(Math.max(0, firstHit.start - 300), firstHit.start + 300);
      const defined = DEFINITION_MARKERS.some((d) => window.includes(d.toLowerCase()));
      const early = firstHit.start / Math.max(1, text.length) < 0.15;
      const treatedAsGiven = defined ? false : early ? true : null;
      // crude constraint estimate: total occurrences vs doc length
      const total = forms.reduce((n, f) => n + findAll(text, f).length, 0);
      const density = total / Math.max(1, ctx.doc.meta.wordCount / 1000);
      const constrains = density > 6 ? "HIGH" : density > 2 ? "MEDIUM" : "LOW";
      rows.push({
        term: cand.term,
        surfaceForms: forms,
        firstSegmentId: segmentIdAt(ctx, firstHit.start) ?? null,
        treatedAsGiven,
        establishmentConditions: defined
          ? `A definition/condition marker appears within ~300 chars of the first use ("…${text.slice(Math.max(0, firstHit.start - 120), firstHit.start + 120).replace(/\s+/g, " ").trim()}…").`
          : null,
        constrainsSubsequent: constrains,
        _ground: groundAround(text, firstHit.start, firstHit.end),
      });
    }
    return {
      categories: rows,
      findings: [
        {
          kind: "CATEGORIES_EXTRACTED",
          summary: `${rows.length} categor${rows.length === 1 ? "y is" : "ies are"} in use.`,
          detail: "This is a watch-list match, not an exhaustive classification. A term the document uses that is not on the list is not captured here.",
          source: "HEURISTIC",
          groundRefs: rows.slice(0, 3).map((r) => (r as { _ground: GroundRef })._ground),
          needsVerification: true,
          uncertaintyText: "`treatedAsGiven` is null wherever the heuristic (early first use, no nearby definition marker) could not decide.",
        },
      ],
    };
  }

  // 3 -----------------------------------------------------------------------
  private categoryIgnition(ctx: AnalyzerContext): StageOutput {
    const cats = (ctx.prior.CATEGORIES?.categories ?? []) as {
      term: string;
      treatedAsGiven: boolean | null;
      constrainsSubsequent: string;
      _ground: GroundRef;
      firstSegmentId: string | null;
    }[];
    const findings: NonNullable<StageOutput["findings"]> = [];
    const ignition: { term: string; record: Record<string, unknown> }[] = [];
    for (const c of cats) {
      ignition.push({
        term: c.term,
        record: {
          changeForm: "IGNITION",
          segmentId: c.firstSegmentId,
          impliedConditions:
            c.treatedAsGiven === true
              ? "None stated near first use — the category is introduced as already available."
              : c.treatedAsGiven === false
                ? "A definition/condition marker is present near first use."
                : "Undetermined.",
          persistsUnderBoundaryChange: "UNKNOWN",
          persistsUnderScaleChange: "UNKNOWN",
          substitutionChangesInference: "UNKNOWN",
          analysisHoldsIfSuspended: "UNKNOWN",
          note: "Boundary/scale-substitution/suspension effects are UNKNOWN from a heuristic pass — these need a reading of the argument, not a term match.",
        },
      });
      if (c.treatedAsGiven === true && (c.constrainsSubsequent === "HIGH" || c.constrainsSubsequent === "MEDIUM")) {
        findings.push({
          kind: "CATEGORY_FIXATION",
          summary: `"${c.term}" is introduced as given and appears to constrain later inference (${c.constrainsSubsequent.toLowerCase()}).`,
          detail: "Check whether the argument would still go through if the establishment conditions for this category were made explicit, or if it were temporarily suspended.",
          source: "HEURISTIC",
          groundRefs: [c._ground],
          needsVerification: true,
          severity: "MEDIUM",
        });
      }
    }
    return { findings, ignition };
  }

  // 4 -----------------------------------------------------------------------
  private weakOperational(ctx: AnalyzerContext): StageOutput {
    const sentences = splitSentences(ctx.doc.text);
    const catTerms = CANDIDATE_CATEGORIES.map((c) => c.term);
    const findings: NonNullable<StageOutput["findings"]> = [];
    for (const s of sentences) {
      const low = s.text.toLowerCase();
      if (!/\b(is|are|consists of|constitutes|means|equals)\b/.test(low)) continue;
      const term = catTerms.find((t) => low.includes(t));
      if (!term) continue;
      if (findings.length >= 8) break;
      findings.push({
        kind: "WEAK_OPERATIONAL_REREAD",
        summary: `Strong statement about "${term}" — a weaker reading is available.`,
        detail: `As written: "${s.text}". A weaker operational reading: describe the *difference / state / transition* asserted here without the categorical "is", and check whether the rest of the argument needs the strong form. (The weak vocabulary is itself revisable — see the methodology note.)`,
        source: "HEURISTIC",
        groundRefs: [sentenceGround(ctx.doc.text, s)],
        needsVerification: true,
      });
    }
    return {
      findings,
      evaluationAxes: [{ axis: "REVISABILITY", fired: true, reading: findings.length ? `${findings.length} categorical statement(s) admit a weaker reading; whether the weaker reading is adopted is a per-claim judgment.` : "No categorical 'X is Y' statements about watched categories found." }],
    };
  }

  // 5 -----------------------------------------------------------------------
  private transition(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const sentences = splitSentences(text);
    const transitions: unknown[] = [];
    for (const s of sentences) {
      const low = s.text.toLowerCase();
      if (!TRANSITION_MARKERS.some((m) => low.includes(m))) continue;
      if (transitions.length >= 12) break;
      const fromTo = s.text.match(/from\s+(.{2,60}?)\s+to\s+(.{2,60}?)(?:[.,;]|$)/i);
      transitions.push({
        fromState: fromTo ? fromTo[1].trim() : "(unspecified — sentence asserts a change)",
        toState: fromTo ? fromTo[2].trim() : "(unspecified)",
        enablingConditions: /\b(if|when|provided that|as long as|requires)\b/i.test(s.text) ? s.text : "",
        disablingConditions: /\b(unless|except when|fails if|only if)\b/i.test(s.text) ? s.text : "",
        dependencyNotes: "",
        conditionSensitivity: "Not determined heuristically — needs a reading of what the sentence depends on.",
        boundaryScaleVariance: "Not determined heuristically.",
        groundRefs: [sentenceGround(text, s)],
        source: "HEURISTIC",
      });
    }
    return {
      transitions,
      findings: transitions.length
        ? [{ kind: "TRANSITION", summary: `${transitions.length} assumed state → state change(s) located.`, detail: "Enabling/disabling conditions were only captured where the sentence stated them explicitly; the rest are marked unspecified.", source: "HEURISTIC", groundRefs: (transitions as { groundRefs: GroundRef[] }[]).slice(0, 3).flatMap((t) => t.groundRefs), needsVerification: true }]
        : [],
    };
  }

  // 6 -----------------------------------------------------------------------
  private historyReinjection(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const rows: unknown[] = [];
    for (const h of HISTORY_MARKERS) {
      for (const form of h.forms) {
        for (const hit of findAll(text, form)) {
          if (rows.length >= 15) break;
          rows.push({
            pastKind: h.kind,
            pastDescription: `The text refers to a prior ${h.kind.toLowerCase().replace("_", " ")}: "…${text.slice(Math.max(0, hit.start - 60), hit.end + 120).replace(/\s+/g, " ").trim()}…"`,
            reinjectedIntoKind: "OTHER",
            reinjectionDescription:
              "How exactly this prior element feeds the current design / classification / inference / access / parameters / conclusion is not determined by a term match — flagged for reading.",
            groundRefs: [groundAround(text, hit.start, hit.end)],
            source: "HEURISTIC",
          });
        }
      }
    }
    return {
      historyReinjections: rows,
      findings: rows.length
        ? [{ kind: "HISTORY_DEPENDENCE", summary: `${rows.length} reference(s) to reused prior operations.`, detail: "This is not a provenance log: the point is to trace how the prior element re-enters later decisions, which a heuristic pass can only flag.", source: "HEURISTIC", groundRefs: (rows as { groundRefs: GroundRef[] }[]).slice(0, 3).flatMap((r) => r.groundRefs), needsVerification: true }]
        : [],
      evaluationAxes: [{ axis: "HISTORY_TRACEABILITY", fired: true, reading: rows.length ? `${rows.length} prior-operation reference(s) found; their re-injection paths are not yet traced.` : "No explicit reuse of prior operations detected in the extracted text." }],
    };
  }

  // 7 -----------------------------------------------------------------------
  private boundaryScale(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const sentences = splitSentences(text);
    const findings: NonNullable<StageOutput["findings"]> = [];
    for (const s of sentences) {
      const low = s.text.toLowerCase();
      const b = BOUNDARY_MARKERS.some((m) => low.includes(m));
      const sc = SCALE_MARKERS.some((m) => low.includes(m));
      if (!b && !sc) continue;
      if (findings.length >= 12) break;
      findings.push({
        kind: b && sc ? "BOUNDARY_DEPENDENCE" : b ? "BOUNDARY_DEPENDENCE" : "SCALE_DEPENDENCE",
        summary: `${b ? "Boundary" : ""}${b && sc ? " & scale" : sc ? "Scale" : ""}-relative description.`,
        detail: `"${s.text}" — check how the main categories, causal relations, dependencies, explanatory units, inferences and evaluations change if the ${b ? "boundary" : "scale"} is redrawn. Configuration C(t,s,b) applies here: ${JSON.stringify(configurationCsb({ scale: sc ? "explicit in this sentence" : undefined, boundary: b ? "explicit in this sentence" : undefined }))}.`,
        source: "HEURISTIC",
        groundRefs: [sentenceGround(text, s)],
        needsVerification: true,
      });
    }
    return {
      findings,
      evaluationAxes: [
        { axis: "BOUNDARY_SENSITIVITY", fired: findings.some((f) => f.kind === "BOUNDARY_DEPENDENCE"), reading: findings.some((f) => f.kind === "BOUNDARY_DEPENDENCE") ? "The document contains explicitly boundary-relative statements; their sensitivity to redrawing the boundary is not yet assessed." : "No explicitly boundary-relative statements found." },
        { axis: "SCALE_SENSITIVITY", fired: findings.some((f) => f.kind === "SCALE_DEPENDENCE"), reading: findings.some((f) => f.kind === "SCALE_DEPENDENCE") ? "The document contains explicitly scale-relative statements." : "No explicitly scale-relative statements found." },
      ],
    };
  }

  // 8 -----------------------------------------------------------------------
  private address(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const nodes: unknown[] = [];
    for (const a of ADDRESS_MARKERS) {
      for (const form of a.forms) {
        for (const hit of findAll(text, form)) {
          if (nodes.length >= 20) break;
          const label = text.slice(hit.start, Math.min(text.length, hit.end + 40)).split(/[.,;\n]/)[0].trim();
          nodes.push({
            kind: a.kind,
            label: label.slice(0, 120),
            roleInGeneration: "Named in the text; its role in generating this output (which categories / access / resources / inferences / evaluations / publishability it shapes) is not determined by a term match.",
            influencesOn: [],
            groundRefs: [groundAround(text, hit.start, hit.end)],
            source: "DOCUMENT",
          });
        }
      }
    }
    return {
      addressNodes: nodes,
      findings: nodes.length
        ? [{ kind: "ADDRESS_CONFIG", summary: `${nodes.length} institutional / material configuration element(s) named.`, detail: "This locates the configuration of output generation. It does not decide who is right — it asks which configuration shapes which category, access, resource, inference, evaluation and publishability.", source: "DOCUMENT", groundRefs: (nodes as { groundRefs: GroundRef[] }[]).slice(0, 3).flatMap((n) => n.groundRefs), needsVerification: true }]
        : [],
      evaluationAxes: [{ axis: "DEPENDENCY_TRANSPARENCY", fired: true, reading: nodes.length ? `${nodes.length} configuration element(s) named; the influence edges are not yet drawn.` : "No institutional/material configuration named in the extracted text." }],
    };
  }

  // 9 -----------------------------------------------------------------------
  private claimEvidence(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const sentences = splitSentences(text);
    const links: unknown[] = [];
    const findings: NonNullable<StageOutput["findings"]> = [];
    sentences.forEach((s, i) => {
      const low = s.text.toLowerCase();
      if (!CLAIM_MARKERS.some((m) => low.includes(m))) return;
      if (links.length >= 15) return;
      const nextTwo = sentences.slice(i + 1, i + 3).map((x) => x.text).join(" ");
      const around = (s.text + " " + nextTwo).toLowerCase();
      const hasCitation = /\[\d+\]|\(\w+ (?:et al\.?,? )?\d{4}\)|\bref\.\s*\d+/.test(s.text + nextTwo);
      const hasData = /\b(table|figure|fig\.|dataset|n\s*=\s*\d|p\s*[<>=]\s*0|percent|%|measured)\b/.test(around);
      const hasEquation = /[=∑∫≈≤≥]/.test(s.text + nextTwo);
      const hasSim = /\b(simulat|numerical experiment|model run|monte carlo)\b/.test(around);
      links.push({
        claimText: s.text,
        claimSegmentId: segmentIdAt(ctx, s.start) ?? null,
        directGroundRefs: [sentenceGround(text, s)],
        citationGroundRefs: hasCitation ? [sentenceGround(text, sentences[i + 1] ?? s)] : [],
        dataGroundRefs: hasData ? [sentenceGround(text, sentences[i + 1] ?? s)] : [],
        modelDependencyText: hasEquation ? "Nearby equation(s) present." : "",
        simulationDependencyText: hasSim ? "Nearby simulation reference present." : "",
        inferenceCompletionText: !hasCitation && !hasData && !hasEquation ? "No citation, data, or equation within two sentences — the step from premises to this claim appears to rest on inference in the text." : "",
        counterexampleText: "",
        alternativeExplanationText: "",
        unverifiedPartsText: "",
        source: "HEURISTIC",
      });
      if (!hasCitation && !hasData && !hasEquation && !hasSim) {
        findings.push({
          kind: "INSUFFICIENT_GROUNDS",
          summary: "Claim with no citation / data / equation within two sentences.",
          detail: `"${s.text}" — the grounds may be elsewhere in the document; this flags it for checking, not as a verdict.`,
          source: "HEURISTIC",
          groundRefs: [sentenceGround(text, s)],
          needsVerification: true,
          severity: "LOW",
        });
      }
    });
    return {
      claimEvidence: links,
      findings,
      evaluationAxes: [{ axis: "EVIDENCE_FIDELITY", fired: true, reading: `${links.length} explicit claim(s) located; ${findings.length} had no nearby citation/data/equation.` }],
    };
  }

  // 10 ----------------------------------------------------------------------
  private doiReview(ctx: AnalyzerContext): StageOutput {
    const doiInText = ctx.doc.text.match(/10\.\d{4,9}\/\S+/)?.[0]?.replace(/[.,;)\]]+$/, "");
    const linked = ctx.linkedRecordSlug || ctx.linkedDoi;
    return {
      findings: [
        {
          kind: "DOI_REVIEW_LINK",
          summary: linked
            ? `Connected to archive record ${ctx.linkedRecordSlug ?? ""}${ctx.linkedDoi ? ` (DOI ${ctx.linkedDoi})` : ""}.`
            : doiInText
              ? `DOI ${doiInText} appears in the text but no matching archive record was found.`
              : "No DOI / archive-record connection.",
          detail:
            "DOI metadata, peer-review status, author responses, revision history, citations, related data and code are linked here so they can feed the history and transition audits. Note: 'has a DOI', 'peer reviewed', and 'highly cited' are NOT treated as fixed proxies for truth or reliability" +
            (ctx.peerReviewStatus ? ` — current review status of the linked record: ${ctx.peerReviewStatus}.` : "."),
          source: "DOCUMENT",
          groundRefs: doiInText ? findAll(ctx.doc.text, doiInText).slice(0, 1).map((h) => groundAround(ctx.doc.text, h.start, h.end)) : [],
          undecidable: !linked && !doiInText,
        },
      ],
    };
  }

  // 11 ----------------------------------------------------------------------
  private simulation(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const detected: Record<string, string[]> = {};
    const grounds: GroundRef[] = [];
    for (const [aspect, markers] of Object.entries(SIMULATION_MARKERS)) {
      const found: string[] = [];
      for (const m of markers) {
        const hits = findAll(text, m);
        if (hits.length) {
          found.push(m);
          if (grounds.length < 6) grounds.push(groundAround(text, hits[0].start, hits[0].end));
        }
      }
      if (found.length) detected[aspect] = found;
    }
    const aspects = Object.keys(detected);
    if (aspects.length < 2) {
      return { notApplicable: { reason: "Fewer than two model-specification aspects present after inspection." } };
    }
    const varyable = [
      "initialCondition", "boundary", "scale", "parameter", "dependencyRemoval",
      "categorySubstitution", "counterfactual",
    ].filter((v) =>
      v === "initialCondition" ? detected.initialConditions :
      v === "boundary" ? detected.boundaryConditions :
      v === "parameter" ? detected.parameters :
      true, // scale / dependencyRemoval / categorySubstitution / counterfactual are always offerable
    );
    return {
      simulationCandidates: [
        {
          description: `Model-specification content present for: ${aspects.join(", ")}. This is a candidate for connection to a simulation backend; nothing is executed in this phase.`,
          detected,
          providerHandoff: {
            provider: "local-stub",
            note: "Descriptor only. A SimulationProvider (e.g. pa-simulation-environment) would consume `detected` + the document to build a runnable configuration.",
            documentRef: ctx.sessionId,
          },
          varyableInputs: varyable,
          groundRefs: grounds,
          source: "HEURISTIC",
        },
      ],
      findings: [
        {
          kind: "SIMULATABLE",
          summary: `Simulation candidate: ${aspects.length} model aspect(s) specified.`,
          detail: "If run, results would be local to a specific model, input, boundary, compute environment and execution time — not reality. Comparable variations to offer: initial condition, boundary, scale, parameters, dependency removal, category substitution, counterfactual conditions.",
          source: "HEURISTIC",
          groundRefs: grounds.slice(0, 3),
          needsVerification: true,
        },
      ],
      evaluationAxes: [{ axis: "REPRODUCIBILITY", fired: true, reading: `Model specification is ${aspects.length >= 5 ? "fairly complete" : "partial"} (${aspects.join(", ")}); code/data availability not assessed here.` }],
    };
  }

  // 12 ----------------------------------------------------------------------
  private counterfactual(ctx: AnalyzerContext): StageOutput {
    const claims = (ctx.prior.CLAIM_EVIDENCE?.claimEvidence ?? []) as { claimText: string; directGroundRefs: GroundRef[] }[];
    const text = ctx.doc.text;
    const statedFalsifiers = FALSIFIABILITY_MARKERS.flatMap((m) => findAll(text, m));
    const findings: NonNullable<StageOutput["findings"]> = [];
    for (const c of claims.slice(0, 8)) {
      const definitional = /\bby definition\b|\bwe define\b|\btautolog/i.test(c.claimText);
      findings.push({
        kind: "COUNTERFACTUAL_CANDIDATE",
        summary: definitional
          ? "Claim appears at least partly definitional — limited falsifiable content."
          : "Claim is a candidate for counterexample / counterfactual probing.",
        detail: `"${c.claimText}" — open questions: what observation would weaken it? what condition change would alter the conclusion? is there an alternative model for the same data? does changing the adopted category dissolve the problem?`,
        source: "HEURISTIC",
        groundRefs: c.directGroundRefs,
        undecidable: true,
        needsVerification: true,
      });
    }
    if (statedFalsifiers.length) {
      findings.push({
        kind: "COUNTERFACTUAL_CANDIDATE",
        summary: `${statedFalsifiers.length} explicitly stated falsification condition(s) — a positive sign.`,
        detail: "The document states conditions under which its claims would fail; these should be checked against the actual results.",
        source: "DOCUMENT",
        groundRefs: statedFalsifiers.slice(0, 3).map((h) => groundAround(text, h.start, h.end)),
      });
    }
    return {
      findings,
      evaluationAxes: [{ axis: "COUNTEREXAMPLE_RESPONSIVENESS", fired: true, reading: statedFalsifiers.length ? "The document states falsification conditions for at least some claims." : "No explicit falsification conditions stated for the claims found." }],
    };
  }

  // 13 ----------------------------------------------------------------------
  private theoryMine(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const sentences = splitSentences(text);
    const mines: unknown[] = [];
    for (const s of sentences) {
      for (const p of THEORY_MINE_PATTERNS) {
        if (!p.re.test(s.text)) continue;
        if (mines.length >= 20) break;
        mines.push({
          claimText: s.text,
          claimSegmentId: segmentIdAt(ctx, s.start) ?? null,
          mineKind: p.mineKind,
          reason: p.reason,
          severity: p.severity,
          groundRefs: [sentenceGround(text, s)],
          source: "HEURISTIC",
        });
      }
    }
    return {
      theoryMines: mines,
      findings: [
        {
          kind: "THEORY_MINE",
          summary: mines.length ? `${mines.length} possible theory mine(s) flagged by phrase pattern.` : "No theory-mine phrase patterns matched.",
          detail: "Phrase-pattern flags are prompts for reading, not verdicts. Absence of matches does not mean absence of over-claiming.",
          source: "HEURISTIC",
          groundRefs: (mines as { groundRefs: GroundRef[] }[]).slice(0, 3).flatMap((m) => m.groundRefs),
          needsVerification: true,
        },
      ],
      evaluationAxes: [{ axis: "REVISABILITY", fired: true, reading: mines.length ? `${mines.length} statement(s) may over-fix or over-generalise; each needs checking against its own support.` : "No phrase-level over-claiming detected." }],
    };
  }

  // 14 ----------------------------------------------------------------------
  private regression(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const sentences = splitSentences(text);
    const findings: NonNullable<StageOutput["findings"]> = [];
    // heuristic: a hedge sentence followed shortly by a strong universal claim
    sentences.forEach((s, i) => {
      const hedge = /\b(may|might|could|suggests|appears to|tentatively|preliminary)\b/i.test(s.text);
      const next = sentences.slice(i + 1, i + 4);
      const strongNext = next.find((n) => /\b(therefore|thus|hence)\b.*\b(always|universal|proves|must|in all cases)\b/i.test(n.text));
      if (hedge && strongNext && findings.length < 6) {
        findings.push({
          kind: "REGRESSION",
          summary: "Hedged premise followed by an unhedged strong conclusion.",
          detail: `Premise: "${s.text}" → Conclusion: "${strongNext.text}". Check whether the conclusion has quietly dropped the qualification of the premise (a regression to a stronger stage than the evidence supports).`,
          source: "HEURISTIC",
          groundRefs: [sentenceGround(text, s), sentenceGround(text, strongNext)],
          needsVerification: true,
          severity: "MEDIUM",
        });
      }
    });
    // Bidirectional: this heuristic layer cannot see the private latest-theory
    // manuscript. Record that the reverse check is owed to a human.
    const theoryFeedback = [
      {
        targetLayer: "LATEST_THEORY",
        proposedChange: "OTHER",
        rationale:
          "The bidirectional check — does this document require modifying / suspending / reclassifying the current ('latest') ZS theory itself — cannot be performed by this heuristic layer, which has no access to the 2026-09-05 ZS manuscript. This is an OPEN item for a human reader. Fitting the document to the existing theory is explicitly NOT the success condition.",
        groundRefs: [],
        source: "HEURISTIC" as const,
        status: "OPEN",
      },
    ];
    return {
      findings,
      regressions: findings.map((f) => ({
        description: f.summary,
        regressedToWhat: f.detail,
        withinDocument: true,
        groundRefs: f.groundRefs ?? [],
        source: "HEURISTIC",
      })),
      theoryFeedback,
      evaluationAxes: [{ axis: "REVISABILITY", fired: true, reading: "Bidirectional theory check is recorded as OPEN — it requires the current ZS manuscript, which this layer does not hold." }],
    };
  }

  // 15 ----------------------------------------------------------------------
  // Straw-Man Risk / Target-Understanding audit. Conditional stage: only runs
  // when the orchestrator found criticism of a specific target. Its job is NOT
  // to say whether the criticism is right — it audits whether the target was
  // reconstructed at its strongest before being criticised. No aggregate score:
  // six dimensions are reported independently.
  private strawManRisk(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const lower = text.toLowerCase();
    const sentences = splitSentences(text);
    const targets = detectCriticismTargets(ctx.doc);

    if (targets.length === 0) {
      return {
        notApplicable: {
          reason:
            "After inspection, no specific person / theory / school / thought-system / scientific model / research programme could be isolated as the target of the criticism.",
        },
      };
    }

    const has = (markers: string[]) => markers.some((m) => lower.includes(m.toLowerCase().trim()));
    const anyRe = (res: RegExp[]) => res.some((re) => re.test(text));

    // Document-wide signals (cheaper to compute once).
    // A parenthetical / bracketed citation: [12], (Author, 1984), (Author 1984; Other 2004), (Author 2004a) …
    const CITATION_RE = /\[\d+\]|\([^()]*\b\d{4}[a-z]?\b[^()]*\)|\b[A-Z][A-Za-z-]+\s+\(\d{4}[a-z]?\)/;
    const docHasCitation = CITATION_RE.test(text);
    const docSecondaryOnly = has(SECONDARY_SOURCE_MARKERS);
    const docOutdated = has(OUTDATED_VERSION_MARKERS);
    const docRevisionAck = has(TARGET_REVISION_MARKERS);
    const docDoesNotConsider = anyRe(TARGET_DOES_NOT_CONSIDER_PATTERNS);
    const docCharitable = has(CHARITABLE_READING_MARKERS);
    const docPeripheral = has(PERIPHERAL_STATEMENT_MARKERS);
    const docProjection = has(CRITIC_CATEGORY_PROJECTION_MARKERS);
    const docContextCut = has(CONTEXT_CUT_MARKERS);
    const docTranslation = has(TRANSLATION_MARKERS);
    const docSelfRevisionThinker = has(SELF_REVISION_METHODOLOGY_MARKERS);

    const rows: unknown[] = [];
    const findings: NonNullable<StageOutput["findings"]> = [];

    for (const t of targets.slice(0, 6)) {
      const near = lower.slice(
        Math.max(0, t.charStart - 700),
        Math.min(lower.length, t.charEnd + 700),
      );
      const nearHas = (markers: string[]) => markers.some((m) => near.includes(m.toLowerCase().trim()));
      const nearCitation = CITATION_RE.test(
        text.slice(Math.max(0, t.charStart - 700), Math.min(text.length, t.charEnd + 700)),
      );

      const risk: string[] = [];

      // --- dimension 1: 一次文献理解 (primary-literature understanding) ------
      let primaryLiterature = "UNDETERMINED";
      if (docSecondaryOnly && !nearCitation) {
        primaryLiterature = "HIGH_RISK";
        risk.push("一次文献不足型");
      } else if (!docHasCitation && !nearCitation) {
        primaryLiterature = "NEEDS_CHECK";
      } else if (nearCitation) {
        primaryLiterature = "NEEDS_CHECK"; // a citation exists, but "is it a *central primary* work" cannot be decided heuristically
      }

      // --- dimension 2: 最新立場整合性 (latest-position alignment) ----------
      let latestPositionAlignment = "UNDETERMINED";
      if ((docOutdated || nearHas(OUTDATED_VERSION_MARKERS)) && !docRevisionAck) {
        latestPositionAlignment = "HIGH_RISK";
        risk.push("旧版固定型");
      } else if (docRevisionAck) {
        latestPositionAlignment = "NEEDS_CHECK";
      }

      // --- dimension 3: 既処理論点見落とし (already-processed-points oversight) -
      let alreadyProcessedPoints = "UNDETERMINED";
      if (docDoesNotConsider) {
        alreadyProcessedPoints = "HIGH_RISK";
        risk.push("既処理論点見落とし型");
        risk.push("対象理解不足型");
      } else {
        alreadyProcessedPoints = "NEEDS_CHECK";
      }

      // --- dimension 4: 強い版への応答 (response to the strong version) ------
      let strongVersionResponse = "UNDETERMINED";
      const weakReadingCues = /\bcrude|simplistic|naive|obviously\s+(?:wrong|false)|absurd|silly|the\s+weak(?:est)?\s+(?:form|version|reading)/i.test(near);
      if (docCharitable) {
        strongVersionResponse = "NEEDS_CHECK"; // charitable-reading language present; still verify it was applied to THIS target
      } else if (weakReadingCues || docDoesNotConsider) {
        strongVersionResponse = "HIGH_RISK";
        risk.push("過度単純化型");
      } else {
        strongVersionResponse = "NEEDS_CHECK";
      }

      // --- dimension 5: 中心命題代表性 (central-proposition representativeness) -
      let centralPropositionRepr = "UNDETERMINED";
      if (docPeripheral || nearHas(PERIPHERAL_STATEMENT_MARKERS)) {
        centralPropositionRepr = "HIGH_RISK";
        risk.push("周辺命題代表化型");
      } else {
        centralPropositionRepr = "NEEDS_CHECK";
      }

      // --- dimension 6: 概念位置の正確性 (concept-position accuracy) ---------
      let conceptLevelAccuracy = "UNDETERMINED";
      if (docProjection || nearHas(CRITIC_CATEGORY_PROJECTION_MARKERS)) {
        conceptLevelAccuracy = "HIGH_RISK";
        risk.push("批判者側カテゴリー投射型");
        risk.push("概念水準混同型");
      } else if (docTranslation) {
        conceptLevelAccuracy = "NEEDS_CHECK";
      }

      if (docContextCut || nearHas(CONTEXT_CUT_MARKERS)) risk.push("文脈切断型");
      if (docTranslation) risk.push("翻訳変形型");
      if (!nearCitation && !docHasCitation) risk.push("帰属不能命題型");

      const understandingInsufficientConcern =
        docDoesNotConsider ||
        primaryLiterature === "HIGH_RISK" ||
        latestPositionAlignment === "HIGH_RISK" ||
        (primaryLiterature === "NEEDS_CHECK" && !nearCitation && !docHasCitation);

      const riskTypes = [...new Set(risk)];

      // --- narrative outputs ------------------------------------------------
      const criticismSentence =
        sentences.find(
          (s) =>
            s.text.toLowerCase().includes(t.label.toLowerCase().split(" ")[0]) &&
            CRITICISM_MARKERS.some((m) => s.text.toLowerCase().includes(m)),
        ) ?? sentences.find((s) => CRITICISM_MARKERS.some((m) => s.text.toLowerCase().includes(m)));
      const criticismSummary = criticismSentence
        ? criticismSentence.text.slice(0, 600)
        : `The document criticises "${t.label}" but the specific critical proposition was not isolated by the heuristic pass.`;

      const grounds = [
        docDoesNotConsider
          ? "The text contains a \"the target does not consider / fails to address X\" construction. Where target understanding is not established from primary literature, this framing cannot be sustained — it must be limited to \"現在確認できる範囲では十分に処理されていない\" / \"一次文献上の確認が不足している\"."
          : null,
        docSecondaryOnly
          ? "Secondary-source language (\"as summarised by\", \"the standard interpretation\", …) is present near the target and no primary citation was found in the surrounding window."
          : null,
        docOutdated && !docRevisionAck
          ? "Only an early / original formulation of the target is referenced, with no acknowledgement of later revision or self-limitation."
          : null,
        docPeripheral
          ? "The criticised statement is framed as an interview / lecture / aside / footnote remark rather than a central proposition."
          : null,
        docProjection
          ? "The critique uses \"must accept\" / \"is committed to\" / \"cannot deny\" constructions that project the critic's categories onto the target."
          : null,
        docContextCut
          ? "A quotation appears to be used with its surrounding conditions / caveats elided."
          : null,
        docTranslation
          ? "A translated technical term is in play; concept strength / negation / modality may shift in translation — original-language correspondence should be checked."
          : null,
      ]
        .filter(Boolean)
        .join("\n") || "No specific straw-man construction was detected by the heuristic pass; the dimensions are reported as 要確認 / 判定不能 pending a reading against primary sources.";

      const strongerReconstruction = [
        `Before re-evaluating the criticism of "${t.label}", reconstruct the target at its strongest:`,
        "· cite the central primary work(s), not summaries or introductions;",
        "· use the latest / mature formulation, not an early version the target later revised or limited;",
        "· restore the target's own limiting conditions, exceptions, and self-corrections;",
        "· identify at which level (ontological / methodological / normative / functional / metaphorical / historical / analytical) the target actually uses the disputed concept;",
        "· confirm the attacked proposition is directly attributable to the target's texts.",
        docSelfRevisionThinker
          ? "· because the target emphasises self-revision / recursive critique / concept revision, prioritise examining the limits that arise when the target's own method is re-applied to the target's own central vocabulary — rather than treating the target as fixed."
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const reviseWhileKeepingCritique =
        "Detecting straw-man risk does not reject the criticism. After reconstructing the target's strongest version, re-state the criticism as: the remaining differences, the limits, the stopping conditions, and the problems the target has genuinely not processed. If, once the target is reconstructed, a residual disagreement can still be shown, the criticism stands in a stronger form. If it cannot, the criticism was resting on the weaker reconstruction.";

      const fiveStage = {
        claim: criticismSummary,
        targetPosition: `(reconstruct from ${t.label}'s primary texts — not yet assembled by this layer)`,
        primaryEvidence: nearCitation
          ? "(a citation is present near the criticism; verify it is a central primary work and represents the latest position)"
          : "(no primary citation found near the criticism — 一次文献上の確認が不足している)",
        strongestReconstruction:
          "(state the target's strongest version, with its limiting conditions and later revisions, before the critique)",
        critique: criticismSummary,
      };

      const recursiveSelfApplicationNote = docSelfRevisionThinker
        ? `"${t.label}" is treated in the document as emphasising self-revision / recursive critique / concept revision. The most important test of the criticism is therefore not whether a weakly-reconstructed version can be defeated, but whether — after establishing the strongest version — the criticism can still show remaining limits when the target's own methodology is recursively re-applied to the target's own central vocabulary.`
        : "";

      const mainStrawManRisk =
        riskTypes.length > 0
          ? `Primary straw-man risk for "${t.label}": ${riskTypes.join(" / ")}.`
          : `No specific straw-man construction detected for "${t.label}" by the heuristic pass; target understanding still needs confirmation against primary sources.`;

      rows.push({
        targetKind: t.kind,
        targetLabel: t.label,
        criticismSummary,
        primaryLiterature,
        latestPositionAlignment,
        alreadyProcessedPoints,
        strongVersionResponse,
        centralPropositionRepr,
        conceptLevelAccuracy,
        riskTypes,
        mainStrawManRisk,
        grounds,
        strongerReconstruction,
        reviseWhileKeepingCritique,
        fiveStage,
        understandingInsufficientConcern,
        recursiveSelfApplicationNote,
        groundRefs: [groundAround(text, t.charStart, t.charEnd, 200)],
        source: "HEURISTIC",
      });

      findings.push({
        kind: understandingInsufficientConcern ? "STRAW_MAN_RISK_UNDERSTANDING_INSUFFICIENT" : "STRAW_MAN_RISK",
        summary: understandingInsufficientConcern
          ? `対象理解不足による藁人形化懸念 — "${t.label}" の批判は「完結した批判」として承認できない。`
          : `"${t.label}" への批判: 対象理解の再構成を要確認。`,
        detail: [
          mainStrawManRisk,
          "",
          "一次文献理解: " + primaryLiterature,
          "最新立場整合性: " + latestPositionAlignment,
          "既処理論点見落とし: " + alreadyProcessedPoints,
          "強い版への応答: " + strongVersionResponse,
          "中心命題代表性: " + centralPropositionRepr,
          "概念位置の正確性: " + conceptLevelAccuracy,
          "",
          "この監査は批判の賛否を判定しない。対象を最も強い形に再構成してから、批判が維持できるかを再評価すること。",
          docDoesNotConsider
            ? "注意: 「対象がこの問題を考えていない」という断定は使用しない。「現在確認できる範囲では十分に処理されていない」「一次文献上の確認が不足している」「対象の最新立場の確認が必要」に限定する。"
            : "",
        ]
          .filter((l) => l !== "" || true)
          .join("\n"),
        source: "HEURISTIC",
        groundRefs: [groundAround(text, t.charStart, t.charEnd, 200)],
        needsVerification: true,
        undecidable: understandingInsufficientConcern,
        severity: understandingInsufficientConcern ? "HIGH" : "MEDIUM",
      });
    }

    return {
      strawManRiskAudits: rows,
      findings,
      evaluationAxes: [
        {
          axis: "TARGET_UNDERSTANDING",
          fired: true,
          reading:
            `${rows.length} criticised target(s) audited. Dimensions are reported independently and are NOT aggregated into a score. ` +
            (rows.some((r) => (r as { understandingInsufficientConcern: boolean }).understandingInsufficientConcern)
              ? "At least one target carries a 対象理解不足による藁人形化懸念 — the corresponding criticism must not be treated as complete until the target is reconstructed from primary literature."
              : "No target was flagged for insufficient understanding by the heuristic pass; reconstruction against primary sources is still required before the criticism is treated as settled."),
        },
      ],
    };
  }
}
