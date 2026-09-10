import type { AuditStage } from "@prisma/client";
import type { ParsedDocument } from "@/lib/documents/parse";
import { findAll } from "@/lib/research-audit/text";
import {
  ADDRESS_MARKERS,
  BOUNDARY_MARKERS,
  CANDIDATE_CATEGORIES,
  COMPARATIVE_SUPERIORITY_MARKERS,
  CRITICISM_MARKERS,
  HISTORY_MARKERS,
  SCALE_MARKERS,
  SIMULATION_MARKERS,
  TRANSITION_MARKERS,
} from "@/lib/research-audit/lexicon";
import { detectCriticismTargets } from "@/lib/research-audit/straw-man";
import { AUDIT_STAGES, type PlannedStage, type ZiranPlan } from "./types";

const METHODOLOGY_VERSION = "ziran-orchestration-2026-09-phase1";

function anyMarker(text: string, markers: string[]): number {
  let n = 0;
  for (const m of markers) n += findAll(text, m).length;
  return n;
}

/**
 * Compose the audit operations for one document.
 *
 * This is the Ziran orchestration layer. It is NOT an always-on universal
 * system: each stage is only FIRED where the document actually gives it
 * something to work on, and NOT_APPLICABLE is recorded with a reason
 * otherwise. `RECLASSIFIED` / `SUSPENDED` are available for stages that turn
 * out mid-run to be doing a different job than planned; `customState` carries
 * change forms outside the named set.
 */
export function planAudit(doc: ParsedDocument, opts: { hasDoiOrRecordLink: boolean }): ZiranPlan {
  const text = doc.text;
  const lower = text.toLowerCase();
  const stages: PlannedStage[] = [];
  let order = 0;

  const fire = (stage: AuditStage, reason: string, scope?: PlannedStage["segmentScope"]) =>
    stages.push({ stage, state: "FIRED", reason, order: order++, segmentScope: scope });
  const skip = (stage: AuditStage, reason: string) =>
    stages.push({ stage, state: "NOT_APPLICABLE", reason, order: order++ });

  // 1. STRUCTURE — always fires (there is always *some* structure to record,
  //    even if it is just a flat paragraph list).
  fire("STRUCTURE", `Document parsed by ${doc.meta.parserName}; ${doc.segments.length} segment(s) identified.`);

  // 2. CATEGORIES — fires if any candidate high-level category surface form
  //    appears. A short methods-only note with none would skip.
  const catHits = CANDIDATE_CATEGORIES.filter((c) => c.forms.some((f) => lower.includes(f)));
  if (catHits.length > 0) {
    fire("CATEGORIES", `${catHits.length} candidate categor${catHits.length === 1 ? "y" : "ies"} present in the text (${catHits.slice(0, 6).map((c) => c.term).join(", ")}${catHits.length > 6 ? ", …" : ""}).`);
  } else {
    skip("CATEGORIES", "No high-level category surface forms found — the document does not appear to operate with the categories this stage watches for.");
  }

  // 3. CATEGORY_IGNITION — only if stage 2 fired.
  if (catHits.length > 0) {
    fire("CATEGORY_IGNITION", "Runs over the categories found in stage 2 to check whether each is given or established.");
  } else {
    skip("CATEGORY_IGNITION", "No categories extracted in stage 2.");
  }

  // 4. WEAK_OPERATIONAL — fires whenever stage 2 fired (there is something to
  //    re-describe). Marked as adopting a revisable vocabulary, not an ontology.
  if (catHits.length > 0) {
    fire("WEAK_OPERATIONAL", "Re-reads the strongest categorical claims with the weaker analytical vocabulary where that adds discrimination.");
  } else {
    skip("WEAK_OPERATIONAL", "Nothing to re-describe — no strong categorical claims detected.");
  }

  // 5. TRANSITION — only if state-change language is present.
  const transN = anyMarker(text, TRANSITION_MARKERS);
  if (transN >= 1) fire("TRANSITION", `${transN} transition marker(s) present — the document assumes at least one state → state change.`);
  else skip("TRANSITION", "No state-change / transition language detected.");

  // 6. HISTORY_REINJECTION — only if the text refers to reusing prior operations.
  const histKinds = HISTORY_MARKERS.filter((h) => h.forms.some((f) => lower.includes(f)));
  if (histKinds.length > 0) fire("HISTORY_REINJECTION", `References to reused prior operations found (${histKinds.map((h) => h.kind.toLowerCase()).join(", ")}).`);
  else skip("HISTORY_REINJECTION", "No explicit reuse of prior measurements / citations / classifications / reviews / models / failures / simulations / institutional judgments detected.");

  // 7. BOUNDARY_SCALE — only if boundary or scale is made explicit anywhere.
  const bN = anyMarker(text, BOUNDARY_MARKERS);
  const sN = anyMarker(text, SCALE_MARKERS);
  if (bN + sN >= 1) fire("BOUNDARY_SCALE", `Boundary markers: ${bN}, scale markers: ${sN} — a boundary/scale-relative description is present.`);
  else skip("BOUNDARY_SCALE", "Neither boundary nor scale is made explicit — Configuration C(t,s,b) would not add discrimination here.");

  // 8. ADDRESS_DOMAIN — only if institutional / material configuration is named.
  const addrKinds = ADDRESS_MARKERS.filter((a) => a.forms.some((f) => lower.includes(f)));
  if (addrKinds.length > 0) fire("ADDRESS_DOMAIN", `Institutional / material configuration named (${addrKinds.map((a) => a.kind.toLowerCase()).join(", ")}).`);
  else skip("ADDRESS_DOMAIN", "No institutes / funders / publishers / compute / instruments / regions named in the extracted text.");

  // 9. CLAIM_EVIDENCE — only if the document makes explicit claims.
  const claimN = anyMarker(text, ["we show", "we find", "we argue", "we conclude", "we propose", "we demonstrate", "our results", "this suggests", "we claim", "we prove"]);
  if (claimN >= 1) fire("CLAIM_EVIDENCE", `${claimN} explicit claim marker(s) — local claim–evidence correspondence can be examined.`);
  else skip("CLAIM_EVIDENCE", "No explicit first-person claim markers — the document may be descriptive or a dataset note.");

  // 10. DOI_REVIEW — only if there is a DOI / archive-record link.
  const doiInText = /10\.\d{4,9}\/\S+/.test(text);
  if (opts.hasDoiOrRecordLink || doiInText) fire("DOI_REVIEW", opts.hasDoiOrRecordLink ? "Matched to an existing archive record." : "A DOI string is present in the document text.");
  else skip("DOI_REVIEW", "No DOI in the text and no matching archive record.");

  // 11. SIMULATION — only if a computational model is specified.
  const simEvidence = Object.values(SIMULATION_MARKERS).reduce((acc, ms) => acc + anyMarker(text, ms), 0);
  if (simEvidence >= 2) fire("SIMULATION", `${simEvidence} model-specification marker(s) — a simulation candidate may be extractable.`);
  else skip("SIMULATION", "Not enough model-specification content (state variables / parameters / conditions / rules / equations / predictions) to propose a simulation.");

  // 12. COUNTERFACTUAL — only if there are claims to probe (needs stage 9).
  if (claimN >= 1) fire("COUNTERFACTUAL", "Probes the explicit claims for weakening observations, alternative models, and definitional vs falsifiable range.");
  else skip("COUNTERFACTUAL", "No explicit claims to probe.");

  // 13. THEORY_MINE — always fires when there is prose (cheap, and absence of
  //     mines is itself informative). Skips for near-empty extraction.
  if (doc.meta.wordCount >= 80) fire("THEORY_MINE", "Scans the strongest statements for over-generalisation / reification / metaphor-realisation / unobservable-mechanism / over-fixation / future-over-specification / local→universal / institutional→truth.");
  else skip("THEORY_MINE", "Extracted text too short to scan meaningfully.");

  // 14. REGRESSION — always fires when stage 13 or 3 fired: it also carries the
  //     bidirectional check (does this document require revising the layer?).
  if (doc.meta.wordCount >= 80) fire("REGRESSION", "Checks for regression to a weaker earlier stage, and records any way the document itself would require modifying / suspending / reclassifying the current methodological layer.");
  else skip("REGRESSION", "Not enough content.");

  // 15. STRAW_MAN_RISK — conditional. Fires ONLY when the document criticises,
  //     rebuts, negatively evaluates, points out limitations of, or claims
  //     comparative superiority over a *specific* person / theory / school /
  //     thought-system / scientific model / research programme. If there is no
  //     such criticism it does not fire.
  const critN = anyMarker(text, CRITICISM_MARKERS);
  const compN = anyMarker(text, COMPARATIVE_SUPERIORITY_MARKERS);
  const smTargets = detectCriticismTargets(doc);
  if ((critN >= 1 || compN >= 1) && smTargets.length > 0) {
    fire(
      "STRAW_MAN_RISK",
      `${critN} criticism marker(s) and ${compN} comparative-superiority marker(s); ${smTargets.length} candidate target(s) of criticism identified (${smTargets
        .slice(0, 4)
        .map((t) => t.label)
        .join(", ")}${smTargets.length > 4 ? ", …" : ""}). Audits whether each target was reconstructed at its strongest before being criticised.`,
    );
  } else if (critN >= 1 || compN >= 1) {
    skip(
      "STRAW_MAN_RISK",
      "Criticism / comparative-superiority language is present, but no specific person, theory, school, thought-system, scientific model, or research programme could be identified as its target.",
    );
  } else {
    skip(
      "STRAW_MAN_RISK",
      "The document contains no criticism, rebuttal, negative evaluation, limitation-pointing, or comparative-superiority claim against a specific target — nothing for this audit to work on.",
    );
  }

  // 16. REPORT — always fires; assembles only the sections that fired.
  fire("REPORT", "Assembles the applicable sections only.");

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    planNote:
      "Stages fire only where the document gives them something to work on. NOT_APPLICABLE is a recorded outcome, not a failure. The stage list itself, and the vocabulary it uses, remain revisable.",
    stages: stages.sort((a, b) => a.order - b.order),
  };
}

export { AUDIT_STAGES };
