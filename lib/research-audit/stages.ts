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
  COMPARATIVE_SUPERIORITY_MARKERS,
  CONTEXT_CUT_MARKERS,
  CRITIC_CATEGORY_PROJECTION_MARKERS,
  CRITICISM_MARKERS,
  FALSIFIABILITY_MARKERS,
  HISTORICAL_DESCRIPTION_MARKERS,
  HISTORY_MARKERS,
  NARROW_OBJECTION_MARKERS,
  OUTDATED_VERSION_MARKERS,
  PAGE_LOCATOR_MARKERS,
  PERIPHERAL_STATEMENT_MARKERS,
  QUALIFICATION_ACK_MARKERS,
  RECONSTRUCTION_MARKERS,
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
import { detectCriticismTargets, type CriticismTarget } from "./straw-man";
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
  // when the orchestrator found *evaluative* criticism of a specific target.
  //
  // Phase 2 rule: this heuristic layer must not pretend to know more about a
  // criticism target than the document permits. It separates
  //   evidencePresence  — what material is in the submission (mechanical)
  //   verificationStatus — whether that material was actually checked (it was not)
  //   dimensions/risk    — how risky the reconstruction looks given the above
  // and NEVER emits 低リスク (LOW_RISK): that requires an evidence-backed
  // substantive verification layer that does not exist. No aggregate score.
  private strawManRisk(ctx: AnalyzerContext): StageOutput {
    const text = ctx.doc.text;
    const lower = text.toLowerCase();
    const sentences = splitSentences(text);
    const targets = detectCriticismTargets(ctx.doc);

    if (targets.length === 0) {
      return {
        notApplicable: {
          reason:
            "After inspection, no specific person / work / theory / model / programme / school / -ism could be isolated as the target of an evaluative criticism.",
        },
      };
    }

    const has = (markers: string[]) => markers.some((m) => lower.includes(m.toLowerCase().trim()));
    const anyRe = (res: RegExp[]) => res.some((re) => re.test(text));
    // A parenthetical / bracketed citation: [12], (Author, 1984), (Author 1984; Other 2004) …
    const CITATION_RE = /\[\d+\]|\([^()]*\b\d{4}[a-z]?\b[^()]*\)|\b[A-Z][A-Za-z-]+\s+\(\d{4}[a-z]?\)/;
    // A direct quotation of the target (≥ 4 words inside quote marks).
    const QUOTATION_RE = /["“][^"”\n]{16,}["”]/;
    const NAMED_WORK_RE = /["“][A-Z][^"”\n]{2,70}["”]|(?:^|\s)_[A-Z][^_\n]{2,70}_/;

    const docSecondaryOnly = has(SECONDARY_SOURCE_MARKERS);
    const docDoesNotConsider = anyRe(TARGET_DOES_NOT_CONSIDER_PATTERNS);
    const docPeripheral = has(PERIPHERAL_STATEMENT_MARKERS);
    const docProjection = has(CRITIC_CATEGORY_PROJECTION_MARKERS);
    const docTranslation = has(TRANSLATION_MARKERS);
    const docSelfRevisionThinker = has(SELF_REVISION_METHODOLOGY_MARKERS);
    const docHistoricalDescription = has(HISTORICAL_DESCRIPTION_MARKERS);
    const docComparativeSuperiority = has(COMPARATIVE_SUPERIORITY_MARKERS);

    const rows: unknown[] = [];
    const findings: NonNullable<StageOutput["findings"]> = [];

    for (const t of targets.slice(0, 6)) {
      const winStart = Math.max(0, Math.min(...t.mentionOffsets) - 450);
      const winEnd = Math.min(text.length, Math.max(...t.mentionOffsets) + 450);
      const nearText = text.slice(winStart, winEnd);
      const near = nearText.toLowerCase();
      const nearHas = (markers: string[]) => markers.some((m) => near.includes(m.toLowerCase().trim()));

      // --- A. evidence-presence detection (mechanical, document properties) ---
      const firstName = t.identity.canonicalName.split(/\s+/)[0].toLowerCase();
      const labelTokens = t.label.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const mentionsTarget = (s: string) => {
        const low = s.toLowerCase();
        return low.includes(firstName) || labelTokens.some((w) => low.includes(w));
      };
      const critMarkerIn = (s: string) =>
        [...CRITICISM_MARKERS, ...COMPARATIVE_SUPERIORITY_MARKERS].some((m) =>
          s.toLowerCase().includes(m.toLowerCase().trim()),
        );
      // A criticism sentence that actually names THIS target, or one inside its
      // mention window — never an arbitrary criticism sentence elsewhere.
      const criticismSentence =
        sentences.find((s) => mentionsTarget(s.text) && critMarkerIn(s.text)) ??
        sentences.find((s) => s.start >= winStart && s.end <= winEnd && critMarkerIn(s.text));

      const evidencePresence = {
        identifiableTarget: true,
        criticismPhrase: Boolean(criticismSentence),
        directQuotation: QUOTATION_RE.test(nearText),
        citationNearCriticism: CITATION_RE.test(nearText),
        namedPrimaryWork: Boolean(t.identity.workTitle) || NAMED_WORK_RE.test(nearText),
        publicationYearOrVersion: Boolean(
          t.identity.publicationYear || t.identity.editionOrVersion || t.identity.periodLabel,
        ),
        pageOrSectionLocator: PAGE_LOCATOR_MARKERS.some((mk) => nearText.includes(mk)),
        targetPositionReconstruction: nearHas(RECONSTRUCTION_MARKERS),
        qualificationAcknowledged: nearHas(QUALIFICATION_ACK_MARKERS),
        laterDevelopmentDiscussed:
          nearHas(TARGET_REVISION_MARKERS) ||
          docHistoricalDescription ||
          t.identity.explicitlyTemporal ||
          /\b(?:in\s+(?:his|her|their)\s+)?later\s+(?:work|writings?|account|view|position|formulation|period)\b|\bthe\s+mature\s+(?:account|view|position|work)\b|\bwent\s+on\s+to\b|\bsubsequently\b/i.test(
            nearText,
          ),
        strongestVersionReconstruction: nearHas(CHARITABLE_READING_MARKERS),
      };

      // --- B. verification status (heuristic layer never externally verifies) -
      let verificationStatus: string;
      if (evidencePresence.namedPrimaryWork && evidencePresence.citationNearCriticism) {
        verificationStatus = "PRIMARY_EVIDENCE_PRESENT_UNVERIFIED";
      } else if (evidencePresence.citationNearCriticism || evidencePresence.directQuotation) {
        verificationStatus = "DOCUMENT_ONLY";
      } else {
        verificationStatus = "VERIFICATION_INSUFFICIENT";
      }

      // --- C. six dimensions — conservative; NEVER LOW_RISK here --------------
      // Default posture: evidence absent → 要確認 (NEEDS_CHECK); genuinely
      // ambiguous → 判定不能 (UNDETERMINED); straw-man indicator → 高リスク.
      const risk: string[] = [];

      // 1 一次文献理解 — a citation is evidence that checking *may* have occurred,
      //   not that it was correct → the best a heuristic pass can return is 要確認.
      let primaryLiterature: string;
      if (docSecondaryOnly && !evidencePresence.citationNearCriticism) {
        primaryLiterature = "HIGH_RISK";
        risk.push("一次文献不足型");
      } else if (!evidencePresence.citationNearCriticism && !evidencePresence.namedPrimaryWork && !evidencePresence.directQuotation) {
        primaryLiterature = "NEEDS_CHECK";
        risk.push("一次文献不足型");
      } else {
        primaryLiterature = "NEEDS_CHECK"; // markers present, correctness unverified
      }

      // 2 最新立場整合性 — only version/period evidence lets us say anything.
      let latestPositionAlignment: string;
      if (t.temporalOvergeneralisation) {
        latestPositionAlignment = "HIGH_RISK";
        risk.push("旧版固定型");
      } else if (nearHas(OUTDATED_VERSION_MARKERS) && !evidencePresence.laterDevelopmentDiscussed) {
        latestPositionAlignment = "HIGH_RISK";
        risk.push("旧版固定型");
      } else if (!t.versionResolved) {
        latestPositionAlignment = "UNDETERMINED"; // which period is targeted is unclear
      } else {
        latestPositionAlignment = "NEEDS_CHECK";
      }

      // 3 既処理論点見落とし — "does not consider X" is a straw-man indicator; the
      //   audit must NOT reproduce the assertion, only the confirmation gap.
      let alreadyProcessedPoints: string;
      if (docDoesNotConsider) {
        alreadyProcessedPoints = "HIGH_RISK";
        risk.push("既処理論点見落とし型", "対象理解不足型");
      } else if (evidencePresence.qualificationAcknowledged) {
        alreadyProcessedPoints = "NEEDS_CHECK"; // the doc engages the target's own limits — still verify
      } else {
        alreadyProcessedPoints = "NEEDS_CHECK";
      }

      // 4 強い版への応答
      let strongVersionResponse: string;
      const weakReadingCues =
        /\bcrude|simplistic|naive|obviously\s+(?:wrong|false|too\s+strong)|absurd|silly|the\s+weak(?:est)?\s+(?:form|version|reading)/i.test(
          near,
        );
      if (weakReadingCues || docDoesNotConsider) {
        strongVersionResponse = "HIGH_RISK";
        risk.push("過度単純化型");
      } else if (evidencePresence.strongestVersionReconstruction) {
        strongVersionResponse = "NEEDS_CHECK"; // charitable-reading language present; verify it was applied here
      } else {
        strongVersionResponse = "NEEDS_CHECK";
      }

      // 5 中心命題代表性
      let centralPropositionRepr: string;
      if (docPeripheral || nearHas(PERIPHERAL_STATEMENT_MARKERS)) {
        centralPropositionRepr = "HIGH_RISK";
        risk.push("周辺命題代表化型");
      } else if (evidencePresence.targetPositionReconstruction) {
        centralPropositionRepr = "NEEDS_CHECK";
      } else {
        centralPropositionRepr = "UNDETERMINED"; // no reconstruction passage → can't tell central vs peripheral
      }

      // 6 概念位置の正確性
      let conceptLevelAccuracy: string;
      if (docProjection || nearHas(CRITIC_CATEGORY_PROJECTION_MARKERS)) {
        conceptLevelAccuracy = "HIGH_RISK";
        risk.push("批判者側カテゴリー投射型", "概念水準混同型");
      } else if (docTranslation) {
        conceptLevelAccuracy = "NEEDS_CHECK";
      } else {
        conceptLevelAccuracy = "UNDETERMINED";
      }

      if (nearHas(CONTEXT_CUT_MARKERS)) risk.push("文脈切断型");
      if (docTranslation) risk.push("翻訳変形型");
      if (!evidencePresence.citationNearCriticism && !evidencePresence.namedPrimaryWork && !evidencePresence.directQuotation) {
        risk.push("帰属不能命題型");
      }

      // Safety net for the acceptance criterion: heuristic-only never asserts 低リスク.
      const dimNoLow = (v: string) => (v === "LOW_RISK" ? "NEEDS_CHECK" : v);
      primaryLiterature = dimNoLow(primaryLiterature);
      latestPositionAlignment = dimNoLow(latestPositionAlignment);
      alreadyProcessedPoints = dimNoLow(alreadyProcessedPoints);
      strongVersionResponse = dimNoLow(strongVersionResponse);
      centralPropositionRepr = dimNoLow(centralPropositionRepr);
      conceptLevelAccuracy = dimNoLow(conceptLevelAccuracy);

      const dims = [
        primaryLiterature,
        latestPositionAlignment,
        alreadyProcessedPoints,
        strongVersionResponse,
        centralPropositionRepr,
        conceptLevelAccuracy,
      ];

      const understandingInsufficientConcern =
        docDoesNotConsider ||
        dims.includes("HIGH_RISK") ||
        verificationStatus === "VERIFICATION_INSUFFICIENT";

      // --- D. critique-survival status (NOT a score, cautious under heuristic) -
      let critiqueSurvival: string;
      const narrowObjection = nearHas(NARROW_OBJECTION_MARKERS) || has(NARROW_OBJECTION_MARKERS);
      if (understandingInsufficientConcern && dims.filter((d) => d === "HIGH_RISK").length >= 2) {
        critiqueSurvival = "CRITIQUE_REQUIRES_REFORMULATION";
      } else if (
        !understandingInsufficientConcern &&
        narrowObjection &&
        evidencePresence.strongestVersionReconstruction &&
        risk.length === 0
      ) {
        critiqueSurvival = "CRITIQUE_APPEARS_STRUCTURALLY_PRESERVABLE";
      } else {
        critiqueSurvival = "CRITIQUE_NOT_YET_TESTED_AGAINST_STRONGEST_TARGET";
      }

      // A comparative-superiority claim counts against THIS target only when a
      // superiority marker and the target sit in the same sentence.
      const comparativeSuperiorityUnverified =
        docComparativeSuperiority &&
        sentences.some(
          (s) =>
            mentionsTarget(s.text) &&
            COMPARATIVE_SUPERIORITY_MARKERS.some((m) => s.text.toLowerCase().includes(m.toLowerCase().trim())),
        );
      if (comparativeSuperiorityUnverified) risk.push("過度単純化型");

      const riskTypes = [...new Set(risk)];

      // --- E. narrative outputs (uncertainty-preserving) --------------------
      const criticismSummary = criticismSentence
        ? criticismSentence.text.slice(0, 600)
        : `The document criticises "${t.label}" but the specific critical proposition was not isolated by the heuristic pass.`;

      const versionLine = t.versionResolved
        ? `対象バージョン: ${describeIdentity(t)}`
        : t.identity.explicitlyTemporal
          ? "TARGET_VERSION_UNRESOLVED — 文中に時期/版の手がかりはあるが、当該批判がどの時期の立場を対象としているか不明。時期区分の確認が必要。"
          : "TARGET_VERSION_UNRESOLVED — 文中に時期/版情報なし。対象は未分化の名称として扱われている。";

      const grounds = [
        versionLine,
        t.temporalOvergeneralisation
          ? "一時期の記述を対象全体へ一般化している可能性 — 批判は「X」全体への強い主張を述べつつ、参照は一つの時期/著作に限られている。対象の後期立場との整合性は未確認。"
          : null,
        docDoesNotConsider
          ? "「対象がXを考慮していない/扱えていない」という構文が検出された。一次文献による対象理解が確立されていない段階では、この断定は用いず「現在確認できる範囲では十分に処理されていない」「一次文献上の確認が不足している」に限定する。"
          : null,
        docSecondaryOnly && !evidencePresence.citationNearCriticism
          ? "二次文献参照の語（「as summarised by」「the standard interpretation」等）が対象付近にあり、一次引用は周辺ウィンドウで検出されなかった。"
          : null,
        docPeripheral
          ? "批判対象の言明がインタビュー/講義/傍論/脚注として枠づけられており、中心命題ではない可能性。"
          : null,
        docProjection
          ? "「must accept」「is committed to」「cannot deny」等、批判者側のカテゴリーを対象へ投射する構文が使われている。"
          : null,
        nearHas(CONTEXT_CUT_MARKERS)
          ? "引用が周囲の条件/留保/反例から切り離されて用いられている可能性。"
          : null,
        docTranslation
          ? "訳語が関与している。概念の強度/否定/様相が翻訳で変形しうるため、原語対応の確認が必要。"
          : null,
        comparativeSuperiorityUnverified
          ? "比較優位主張は検出されたが、比較対象の最大強度版との照合が必要 — この監査は優位主張自体を承認しない。"
          : null,
        `evidencePresence: ${Object.entries(evidencePresence)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ") || "(なし)"} / verificationStatus: ${verificationStatus}`,
      ]
        .filter(Boolean)
        .join("\n");

      const strongerReconstruction = [
        `"${t.label}" への批判を再評価する前に、対象を最も強い形で再構成すること（対象を弱く再構成したまま「新しい/Xを超える」と述べてはならない）:`,
        "・要約や入門書ではなく、中心的な一次文献を参照する;",
        t.versionResolved
          ? `・当該批判が対象とする時期/版（${describeIdentity(t)}）に限定されているかを明示する;`
          : "・当該批判がどの時期/版の立場を対象としているかを特定する（時期区分の確認が必要）;",
        "・対象自身による限定条件・例外・自己修正を復元する（後期の自己修正が無視されていないか、後期の立場が過去へ不当に投影されていないか、初期の立場が対象の恒常的見解として扱われていないか）;",
        "・対象が当該概念をどの水準（存在論的/方法論的/規範的/機能的/隠喩的/歴史的/分析的）で用いているかを特定する;",
        "・攻撃されている命題が対象のテクストに直接帰属できるかを確認する。",
        docSelfRevisionThinker
          ? "・対象が自己修正/再帰的批判/概念改訂を掲げている場合、対象を固定的に扱わず、対象自身の方法を対象自身の中心語彙へ再帰適用したときに生じる限界を優先的に検討する。"
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const reviseWhileKeepingCritique =
        "藁人形化リスクの検出は批判の却下を意味しない。対象の最強版を再構成したうえで、批判を「残る差異・限界・停止条件・対象が実際に未処理の問題」として述べ直すこと。再構成後にも残余の不一致を示せるなら、批判はより強い形で維持される。示せないなら、その批判は弱い再構成に依存していた。批判を弱めて藁人形化リスクを消すのではなく、まず対象の再構成を強くし、そのうえで残る批判を保持する。";

      // Five-stage scaffold — repair language, never fabricated facts.
      const targetPosition = evidencePresence.targetPositionReconstruction
        ? "文中に対象立場の再構成らしき記述あり。一次文献との対応は未確認。"
        : "未確定。対象に帰属される命題が明示的に再構成されていない。一次文献による確認が必要。";
      const primaryEvidence = evidencePresence.citationNearCriticism || evidencePresence.namedPrimaryWork
        ? `文献手がかりあり（${[
            t.identity.workTitle ? `著作: ${t.identity.workTitle}` : null,
            t.identity.publicationYear ? `年: ${t.identity.publicationYear}` : null,
            t.identity.editionOrVersion ? `版: ${t.identity.editionOrVersion}` : null,
            evidencePresence.pageOrSectionLocator ? "頁/節指定あり" : null,
          ]
            .filter(Boolean)
            .join(" / ") || "近傍に引用あり"}）。ただし中心的一次文献か・最新立場かは未確認。`
        : "未確定。批判の帰属根拠となる著作/頁/版が示されていない。";
      const strongestReconstruction = evidencePresence.strongestVersionReconstruction
        ? "文中に最強版再構成らしき記述あり。対象自身の限定・例外・後期修正が網羅されているかは未確認。"
        : "未確定。対象自身による限定・例外・後期修正の一次文献確認が必要。";
      const fiveStage = {
        claim: criticismSummary,
        targetPosition,
        primaryEvidence,
        strongestReconstruction,
        critique: `再構成後に残る批判: 未検証（${critiqueSurvival}）。`,
      };

      // Recursive self-revision — operational questions, uncertainty-preserving.
      const recursiveSelfApplicationNote =
        docSelfRevisionThinker || t.identity.explicitlyTemporal || docHistoricalDescription
          ? [
              `"${t.label}" は文中で自己修正的/歴史的に変化する対象として扱われている（またはその可能性がある）。以下を確認すること:`,
              "1. どの版/時期が批判対象か。",
              "2. 批判はその版/時期に明示的に限定されているか。",
              "3. 後期の自己修正が無視されていないか。",
              "4. 後期の立場が過去へ不当に投影されていないか。",
              "5. 初期の立場が対象の恒常的見解として扱われていないか。",
              "確証のない限り「Xは後にこの見解を放棄した」「Xはこれを考慮しなかった」「Xの真の立場は〜」とは書かない。代わりに「時期区分の確認が必要」「対象の後期立場との整合性は未確認」「当該批判がどの時期の立場を対象としているか不明」と記す。",
            ].join("\n")
          : "";

      const mainStrawManRisk =
        riskTypes.length > 0
          ? `"${t.label}" の主要な藁人形化リスク: ${riskTypes.join(" / ")}。（証拠の不在はリスク警告を正当化するが、引用の存在だけでは対象理解が正しいという確信を正当化しない。）`
          : `"${t.label}" について特定の藁人形化構文は検出されなかったが、対象理解は一次文献との照合が未了。dimensions は 要確認 / 判定不能。`;

      // multi-role ground refs for this row
      const rowGroundRefs: GroundRef[] = [
        ...t.grounds.map((g) => ({
          segmentId: segmentIdAt(ctx, g.charStart),
          charStart: g.charStart,
          charEnd: g.charEnd,
          quote: g.quote,
          role: g.role,
        })),
      ];
      if (criticismSentence) {
        rowGroundRefs.push({
          ...sentenceGround(text, criticismSentence),
          segmentId: segmentIdAt(ctx, criticismSentence.start),
          role: "criticism-phrase",
        });
      }
      const quoteMatch = nearText.match(QUOTATION_RE);
      if (quoteMatch) {
        const qi = winStart + nearText.indexOf(quoteMatch[0]);
        rowGroundRefs.push({
          segmentId: segmentIdAt(ctx, qi),
          charStart: qi,
          charEnd: qi + quoteMatch[0].length,
          quote: quoteMatch[0].slice(0, 200),
          role: "quotation",
        });
      }
      if (evidencePresence.targetPositionReconstruction) {
        const rm = RECONSTRUCTION_MARKERS.map((mk) => near.indexOf(mk.toLowerCase())).find((i) => i >= 0);
        if (rm !== undefined && rm >= 0) {
          rowGroundRefs.push({
            ...groundAround(text, winStart + rm, winStart + rm + 40, 120),
            segmentId: segmentIdAt(ctx, winStart + rm),
            role: "reconstruction-passage",
          });
        }
      }
      if (rowGroundRefs.length === 0) {
        rowGroundRefs.push(groundAround(text, t.charStart, t.charEnd, 200));
      }

      rows.push({
        targetKind: t.kind,
        targetLabel: t.label,
        criticismSummary,
        targetIdentity: t.identity,
        targetVersionResolved: t.versionResolved,
        evidencePresence,
        verificationStatus,
        critiqueSurvival,
        comparativeSuperiorityUnverified,
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
        groundRefs: rowGroundRefs,
        source: "HEURISTIC",
      });

      findings.push({
        kind: understandingInsufficientConcern
          ? "STRAW_MAN_RISK_UNDERSTANDING_INSUFFICIENT"
          : "STRAW_MAN_RISK",
        summary: understandingInsufficientConcern
          ? `対象理解不足による藁人形化懸念 — "${t.label}" の批判は「完結した批判」として承認できない。`
          : `"${t.label}" への批判: 対象理解の再構成を要確認。`,
        detail: [
          mainStrawManRisk,
          versionLine,
          "",
          "一次文献理解: " + primaryLiterature,
          "最新立場整合性: " + latestPositionAlignment,
          "既処理論点見落とし: " + alreadyProcessedPoints,
          "強い版への応答: " + strongVersionResponse,
          "中心命題代表性: " + centralPropositionRepr,
          "概念位置の正確性: " + conceptLevelAccuracy,
          `verificationStatus: ${verificationStatus} / critiqueSurvival: ${critiqueSurvival}`,
          "",
          "この監査は批判の賛否を判定しない。対象を最も強い形に再構成してから、批判が維持できるかを再評価すること。",
          docDoesNotConsider
            ? "注意: 「対象がこの問題を考えていない」という断定は使用しない。「現在確認できる範囲では十分に処理されていない」「一次文献上の確認が不足している」「対象の最新立場の確認が必要」に限定する。"
            : "",
        ].join("\n"),
        source: "HEURISTIC",
        groundRefs: rowGroundRefs,
        needsVerification: true,
        undecidable: understandingInsufficientConcern,
        severity: understandingInsufficientConcern ? "HIGH" : "MEDIUM",
      });
    }

    const anyUnresolved = rows.some((r) => !(r as { targetVersionResolved: boolean }).targetVersionResolved);
    const anyComparative = rows.some(
      (r) => (r as { comparativeSuperiorityUnverified: boolean }).comparativeSuperiorityUnverified,
    );

    return {
      strawManRiskAudits: rows,
      findings,
      evaluationAxes: [
        {
          axis: "TARGET_UNDERSTANDING",
          fired: true,
          reading:
            `${rows.length} criticised target(s) audited. Dimensions are reported independently and are NOT aggregated into a score; the heuristic layer never returns 低リスク. ` +
            (rows.some((r) => (r as { understandingInsufficientConcern: boolean }).understandingInsufficientConcern)
              ? "At least one target carries a 対象理解不足による藁人形化懸念 — the corresponding criticism must not be treated as complete until the target is reconstructed from primary literature. "
              : "") +
            (anyUnresolved
              ? "At least one target's version/period identity is unresolved (TARGET_VERSION_UNRESOLVED). "
              : "") +
            (anyComparative
              ? "A comparative-superiority claim was detected but not matched against the strongest version of the compared target."
              : ""),
        },
      ],
    };
  }
}

/** Human-readable version identity for a resolved target. */
function describeIdentity(t: CriticismTarget): string {
  const id = t.identity;
  return (
    [
      id.periodLabel ? `時期: ${id.periodLabel}` : null,
      id.workTitle ? `著作: ${id.workTitle}` : null,
      id.editionOrVersion ? `版: ${id.editionOrVersion}` : null,
      id.publicationYear ? `年: ${id.publicationYear}` : null,
    ]
      .filter(Boolean)
      .join(" / ") || id.canonicalName
  );
}
