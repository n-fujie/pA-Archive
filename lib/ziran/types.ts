import type { AuditStage, StageActivationState } from "@prisma/client";

/**
 * The 15 audit stages of the spec, in order, with human-facing names.
 * The Ziran orchestrator decides which of these fire for a given document.
 */
export const AUDIT_STAGES: { id: AuditStage; n: number; label: string; blurb: string }[] = [
  { id: "STRUCTURE", n: 1, label: "Document structure", blurb: "Recognise title / abstract / sections / citations / references / figures / equations / data / methods / results / conclusions where they exist — never force-generate them." },
  { id: "CATEGORIES", n: 2, label: "Category extraction", blurb: "Extract the main categories the document works with (human, AI, life, subject, intelligence, science, evidence, data, model, society, machine, capital, …)." },
  { id: "CATEGORY_IGNITION", n: 3, label: "Category establishment", blurb: "For each category: is it treated as given from the start, or are its conditions of establishment made explicit?" },
  { id: "WEAK_OPERATIONAL", n: 4, label: "Weaker operational re-reading", blurb: "Re-describe with the weaker vocabulary (difference / state / transition / dependency / relation / time / scale / boundary / history / access / configuration) — revisable, not final." },
  { id: "TRANSITION", n: 5, label: "Transition audit", blurb: "Which state → state changes are assumed; which conditions enable / disable them; which dependencies are involved; what changes the result." },
  { id: "HISTORY_REINJECTION", n: 6, label: "History re-injection", blurb: "How past measurements / citations / classifications / reviews / model selections / failures / simulations / institutional judgments were fed back into later design, classification, inference, access, parameters, conclusions." },
  { id: "BOUNDARY_SCALE", n: 7, label: "Boundary & scale audit", blurb: "How much do categories / causal relations / dependencies / explanatory units / inferences / evaluations change when the boundary or scale changes?" },
  { id: "ADDRESS_DOMAIN", n: 8, label: "Address / domain analysis", blurb: "Track institutes, universities, companies, states, publishers, funders, grants, compute, data infrastructure, models, instruments, networks, regions, institutions, review structures as local configurations of output generation — not to decide who is right." },
  { id: "CLAIM_EVIDENCE", n: 9, label: "Claim–evidence (local)", blurb: "Per main claim: direct grounds in text, citation grounds, data grounds, model dependency, simulation dependency, inference completion, counterexamples, alternative explanations, unverified parts." },
  { id: "DOI_REVIEW", n: 10, label: "DOI / review connection", blurb: "If the document has a DOI or matches an archive record, connect its DOI metadata and existing review — without treating 'has DOI' / 'peer reviewed' / 'highly cited' as a proxy for truth." },
  { id: "SIMULATION", n: 11, label: "Simulation possibility", blurb: "Detect model / state variables / parameters / initial & boundary conditions / transition rules / equations / predictions; propose what could be varied. Simulation results are local, not reality." },
  { id: "COUNTERFACTUAL", n: 12, label: "Counterexample / counterfactual", blurb: "What observation would weaken the claim; what condition change alters the conclusion; alternative models; whether changing the adopted category dissolves the problem; falsifiable vs definitional range." },
  { id: "THEORY_MINE", n: 13, label: "Theory-mine audit", blurb: "Over-generalisation, unverified ontological reification, physical realisation of metaphor, assertion of unobservable mechanism, category over-fixation, future over-specification, local→universal leap, institutional-evaluation→truth conversion." },
  { id: "REGRESSION", n: 14, label: "Regression audit (bidirectional)", blurb: "Has the document (or this implementation) regressed to a weaker earlier stage? And: does the new object require modifying / suspending / reclassifying the current theory itself?" },
  { id: "STRAW_MAN_RISK", n: 15, label: "Straw-man risk / target-understanding audit", blurb: "Fires only when the document criticises a specific person / theory / school / thought-system / scientific model / research programme. Audits whether the target was sufficiently understood and reconstructed before being criticised — not whether the criticism is right. No aggregate score; six dimensions shown independently as 低リスク / 要確認 / 高リスク / 判定不能. Reconstruct the target's strongest version first, then re-evaluate whether the criticism still holds." },
  { id: "REPORT", n: 16, label: "Audit report", blurb: "Assemble only the sections that actually apply — non-applicable stages are not shown." },
];

export const STAGE_BY_ID = Object.fromEntries(AUDIT_STAGES.map((s) => [s.id, s])) as Record<
  AuditStage,
  (typeof AUDIT_STAGES)[number]
>;

/**
 * A single planned stage. The orchestrator produces one of these per stage;
 * `state` may be NOT_APPLICABLE with a reason (the stage does not fire).
 * `customState` carries a change form outside the named set.
 */
export interface PlannedStage {
  stage: AuditStage;
  state: StageActivationState;
  customState?: string;
  reason: string;
  /** Segments / char ranges the stage will operate over, if scoped. */
  segmentScope?: { segmentIds?: string[]; ranges?: { start: number; end: number }[]; note?: string };
  order: number;
}

export interface ZiranPlan {
  methodologyVersion: string;
  planNote: string;
  stages: PlannedStage[];
}

/** A ground reference — every finding must anchor to the document. */
export interface GroundRef {
  segmentId?: string;
  charStart: number;
  charEnd: number;
  quote: string;
}

/** What an analyzer returns for one stage. Persisted by the pipeline. */
export interface StageOutput {
  /** Free-form findings (persisted to audit_findings). */
  findings?: {
    kind: string;
    summary: string;
    detail?: string;
    source: "DOCUMENT" | "HEURISTIC" | "AI_INFERENCE" | "MIXED";
    inferencePath?: string;
    groundRefs?: GroundRef[];
    uncertaintyText?: string;
    undecidable?: boolean;
    needsVerification?: boolean;
    severity?: "INFO" | "LOW" | "MEDIUM" | "HIGH" | null;
    aiOperationId?: string;
  }[];
  /** Stage-specific structured rows (persisted to the matching table). */
  categories?: unknown[];
  /** Category-ignition records: [{ term, record }] — matched to categories by term. */
  ignition?: { term: string; record: Record<string, unknown> }[];
  transitions?: unknown[];
  dependencies?: unknown[];
  historyReinjections?: unknown[];
  addressNodes?: unknown[];
  claimEvidence?: unknown[];
  simulationCandidates?: unknown[];
  theoryMines?: unknown[];
  regressions?: unknown[];
  /** Straw-man risk / target-understanding audit rows (one per criticised target). */
  strawManRiskAudits?: unknown[];
  theoryFeedback?: unknown[];
  evaluationAxes?: { axis: string; fired: boolean; reading: string }[];
  /** If this stage decided it does not apply after inspecting content. */
  notApplicable?: { reason: string };
}
