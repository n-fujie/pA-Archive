/**
 * Curated term lists used by the heuristic analyzers.
 *
 * These are seeds for *discrimination*, not a closed classification. A term
 * matching here is a prompt for the audit panel, never a verdict, and the
 * category list is explicitly "including but not limited to" per the brief.
 */

/** Stage 2 — candidate high-level categories a research document may treat as given. */
export const CANDIDATE_CATEGORIES: { term: string; forms: string[] }[] = [
  { term: "human", forms: ["human", "humans", "humanity", "people", "person", "persons"] },
  { term: "AI", forms: ["ai", "artificial intelligence", "machine intelligence", "a.i."] },
  { term: "life", forms: ["life", "living", "organism", "organisms", "biological life"] },
  { term: "subject", forms: ["subject", "subjects", "subjectivity", "the subject"] },
  { term: "intelligence", forms: ["intelligence", "intelligent", "cognition", "cognitive"] },
  { term: "science", forms: ["science", "scientific", "the sciences"] },
  { term: "evidence", forms: ["evidence", "evidential", "empirical support"] },
  { term: "data", forms: ["data", "dataset", "datasets", "the data"] },
  { term: "model", forms: ["model", "models", "modelling", "modeling"] },
  { term: "society", forms: ["society", "social", "societal", "the social"] },
  { term: "machine", forms: ["machine", "machines", "mechanical"] },
  { term: "capital", forms: ["capital", "capitalist", "capitalism"] },
  { term: "consciousness", forms: ["consciousness", "conscious", "sentience", "sentient"] },
  { term: "agent", forms: ["agent", "agents", "agency"] },
  { term: "system", forms: ["system", "systems"] },
  { term: "nature", forms: ["nature", "natural", "the natural world"] },
  { term: "truth", forms: ["truth", "true", "the truth"] },
  { term: "knowledge", forms: ["knowledge", "knowing", "epistemic"] },
  { term: "reality", forms: ["reality", "real", "the real"] },
  { term: "value", forms: ["value", "values", "valuation"] },
  { term: "market", forms: ["market", "markets"] },
  { term: "power", forms: ["power", "domination", "hegemony"] },
  { term: "language", forms: ["language", "linguistic", "discourse"] },
  { term: "meaning", forms: ["meaning", "semantic", "semantics"] },
];

/** Stage 5 — surface markers of an assumed state → state change. */
export const TRANSITION_MARKERS = [
  "transition", "transitions", "shift", "shifts", "shifted", "moves from", "move from",
  "becomes", "became", "turns into", "gives rise to", "leads to", "results in",
  "emerges", "emergence", "collapse", "collapses", "phase transition", "tipping point",
  "before and after", "from … to", "evolves into", "converges to", "diverges",
  "onset of", "breakdown of", "switch to",
];

/** Stage 7 — surface markers that a description is boundary- or scale-relative. */
export const BOUNDARY_MARKERS = [
  "boundary", "boundaries", "within the system", "outside the system", "closed system",
  "open system", "the environment", "system and environment", "delimit", "delimited",
  "scope of analysis", "unit of analysis", "we consider only", "excluding", "including only",
  "at the level of", "isolated from",
];
export const SCALE_MARKERS = [
  "scale", "at the micro", "at the macro", "microscale", "macroscale", "mesoscale",
  "coarse-grained", "fine-grained", "resolution", "aggregate", "aggregated", "individual level",
  "population level", "orders of magnitude", "time scale", "timescale", "length scale",
  "at short times", "at long times", "in the limit of",
];

/** Stage 8 — surface markers of institutional / material configuration. */
export const ADDRESS_MARKERS: { kind: string; forms: string[] }[] = [
  { kind: "UNIVERSITY", forms: ["university", "college", "institute of technology", "école", "universität"] },
  { kind: "INSTITUTE", forms: ["institute", "laboratory", "national lab", "research center", "research centre", "max planck", "cnrs"] },
  { kind: "COMPANY", forms: ["inc.", "corp.", "ltd", "gmbh", "llc", "google", "microsoft", "openai", "deepmind", "meta ai", "anthropic", "nvidia"] },
  { kind: "FUNDER", forms: ["funded by", "grant", "grant no", "supported by", "nsf", "nih", "erc", "darpa", "jsps", "horizon europe", "wellcome"] },
  { kind: "PUBLISHER", forms: ["elsevier", "springer", "nature portfolio", "wiley", "ieee", "acm", "plos", "arxiv", "biorxiv", "preprint server"] },
  { kind: "COMPUTE", forms: ["gpu", "tpu", "hpc", "supercomputer", "cluster", "compute cluster", "a100", "h100", "cloud compute"] },
  { kind: "DATA_INFRA", forms: ["repository", "data portal", "database", "the archive", "zenodo", "figshare", "dryad", "genbank"] },
  { kind: "MODEL", forms: ["gpt-", "llama", "bert", "resnet", "transformer model", "pretrained model", "foundation model"] },
  { kind: "INSTRUMENT", forms: ["telescope", "microscope", "spectrometer", "detector", "sequencer", "mri", "lhc", "interferometer"] },
  { kind: "REGION", forms: ["in the united states", "in china", "in europe", "in japan", "in the uk", "global south", "global north"] },
];

/** Stage 6 — surface markers that prior operations are being reused. */
export const HISTORY_MARKERS: { kind: string; forms: string[] }[] = [
  { kind: "MEASUREMENT", forms: ["previous measurements", "prior measurements", "earlier observations", "historical data", "archival data"] },
  { kind: "CITATION", forms: ["following ref", "as reported in", "building on", "as shown by", "prior work", "established in the literature"] },
  { kind: "CLASSIFICATION", forms: ["the standard classification", "conventionally classified", "the accepted taxonomy", "previously categorised", "previously categorized"] },
  { kind: "REVIEW", forms: ["reviewer", "peer review", "in response to reviewers", "revised version", "after review"] },
  { kind: "MODEL_SELECTION", forms: ["we chose the model", "model was selected", "following common practice", "the standard model", "baseline model"] },
  { kind: "FAILURE", forms: ["previous attempts failed", "did not work", "earlier failure", "prior negative result", "unsuccessful"] },
  { kind: "SIMULATION", forms: ["previous simulations", "earlier runs", "prior numerical experiments"] },
  { kind: "INSTITUTIONAL_JUDGMENT", forms: ["accepted for publication", "approved by the committee", "ethics approval", "consensus statement", "the field agrees"] },
];

/** Stage 11 — surface markers that a computational model is specified. */
export const SIMULATION_MARKERS = {
  stateVariables: ["state variable", "state variables", "we denote the state", "let x be", "phase space", "degrees of freedom"],
  parameters: ["parameter", "parameters", "coefficient", "we set", "fixed at", "tuned to", "hyperparameter"],
  initialConditions: ["initial condition", "initial conditions", "initially", "at t = 0", "starting from", "seed"],
  boundaryConditions: ["boundary condition", "boundary conditions", "periodic boundary", "dirichlet", "neumann", "no-flux"],
  transitionRules: ["update rule", "transition rule", "evolution equation", "dynamics given by", "we iterate", "time step", "integrator"],
  equations: ["equation", "eq.", "we solve", "governed by", "obeys", "\\frac", "d/dt", "∂"],
  predictions: ["predicts", "we predict", "forecast", "expected to yield", "projection", "extrapolate"],
};

/** Stage 13 — phrases that flag possible theory mines. Each maps to a mine kind. */
export const THEORY_MINE_PATTERNS: { re: RegExp; mineKind: string; reason: string; severity: "LOW" | "MEDIUM" | "HIGH" }[] = [
  { re: /\b(?:always|never|in all cases|universally|without exception|for any|for all)\b/i, mineKind: "OVER_GENERALIZATION", reason: "Universal quantifier — check whether the support is universal or local.", severity: "MEDIUM" },
  { re: /\b(?:proves|proven|demonstrates conclusively|establishes beyond doubt|definitively shows)\b/i, mineKind: "OVER_GENERALIZATION", reason: "Proof-strength claim — check whether the evidence is deductive or inductive.", severity: "MEDIUM" },
  { re: /\bis (?:nothing but|merely|just|simply) (?:a|an|the)\b/i, mineKind: "ONTOLOGICAL_REIFICATION", reason: "Reductive identity claim — check whether it is definitional or empirical.", severity: "MEDIUM" },
  { re: /\bthe (?:true|real|fundamental|essential) nature of\b/i, mineKind: "ONTOLOGICAL_REIFICATION", reason: "Essence claim — check whether an essence is required or a description would do.", severity: "MEDIUM" },
  { re: /\bthe brain is (?:a|like a) computer|the mind is software|society is an organism|the market is a mind\b/i, mineKind: "METAPHOR_REALIZATION", reason: "Metaphor stated as physical identity.", severity: "HIGH" },
  { re: /\b(?:underlying|hidden|deep) mechanism (?:is|must be|is necessarily)\b/i, mineKind: "UNOBSERVABLE_MECHANISM_ASSERTION", reason: "Assertion about an unobserved mechanism — check observational access.", severity: "MEDIUM" },
  { re: /\b(?:by \d{4}|within \d+ years|in the next decade)\b.*\b(?:will|shall|is going to)\b/i, mineKind: "FUTURE_OVER_SPECIFICATION", reason: "Dated future assertion — check how the time point is grounded.", severity: "LOW" },
  { re: /\b(?:therefore|hence|thus) .*\b(?:in general|for any system|as a universal principle|as a law)\b/i, mineKind: "LOCAL_TO_UNIVERSAL_LEAP", reason: "Generalisation step from a local result.", severity: "MEDIUM" },
  { re: /\b(?:published in|peer[- ]reviewed|highly cited|nature|science|cell)\b.*\b(?:therefore|so it is|which shows it is)\b.*\b(?:true|correct|reliable|valid)\b/i, mineKind: "INSTITUTIONAL_TO_TRUTH", reason: "Institutional standing used as a truth argument.", severity: "HIGH" },
];

/** Stage 9 — sentence-initial markers of a claim. */
export const CLAIM_MARKERS = [
  "we show", "we find", "we demonstrate", "we argue", "we conclude", "we propose",
  "this suggests", "this implies", "it follows that", "our results indicate",
  "we establish", "we prove", "the data show", "we claim",
];

/** Stage 12 — markers of an already-stated falsification condition (good sign). */
export const FALSIFIABILITY_MARKERS = [
  "would be falsified", "would disconfirm", "if instead", "a counterexample would be",
  "this prediction fails if", "would rule out", "we would expect to see", "otherwise our model predicts",
];

// ---------------------------------------------------------------------------
// Stage 15 — Straw-Man Risk / Target Understanding Audit
// ---------------------------------------------------------------------------

/** Markers that the document is CRITICISING a named position, not just citing it. */
export const CRITICISM_MARKERS = [
  "criticis", "critique", "objection to", "we reject", "we deny", "fails to",
  "is mistaken", "is wrong", "is flawed", "cannot account for", "overlooks",
  "ignores", "neglects", "misunderstands", "is untenable", "collapses under",
  "does not hold", "is inadequate", "is insufficient", "is naive", "is confused",
  "contra ", "against the view", "pace ", "problem with", "the limitation of",
  "the weakness of", "we take issue with", "runs into difficulty", "is refuted",
  "is a mistake", "is misguided", "breaks down", "is question-begging",
];

/** Markers of a comparative-superiority claim ("our approach is better than X"). */
export const COMPARATIVE_SUPERIORITY_MARKERS = [
  "unlike", "in contrast to", "superior to", "better than", "improves on",
  "goes beyond", "avoids the problems of", "does not suffer from",
  "whereas the standard view", "our account, by contrast", "more adequate than",
];

/** The single most serious pattern: asserting the target does not think about X.
 *  Stage 15 must NOT reproduce this framing — it limits it to
 *  "primary-literature confirmation is insufficient" instead. */
export const TARGET_DOES_NOT_CONSIDER_PATTERNS: RegExp[] = [
  /\b(?:he|she|they|the author|[A-Z][a-z]+)\s+(?:does|do|did)\s+not\s+(?:consider|address|discuss|see|realise|realize|acknowledge|recognise|recognize|notice|entertain)\b/i,
  /\b(?:never|nowhere)\s+(?:considers|addresses|discusses|acknowledges|entertains)\b/i,
  /\b(?:fails|failed)\s+to\s+(?:consider|address|see|recognise|recognize|acknowledge|notice)\b/i,
  /\bis\s+(?:blind|oblivious)\s+to\b/i,
  /\bhas\s+(?:no|not?)\s+(?:answer|response|account|reply)\s+to\b/i,
];

/** Markers that only an OLD / early formulation is being used. */
export const OUTDATED_VERSION_MARKERS = [
  "in his early", "in her early", "early work", "the early ", "originally argued",
  "initially claimed", "first formulation", "1960s formulation", "1970s formulation",
  "the young ", "before he revised", "before she revised", "in the first edition",
  "the earlier position", "as first stated", "the initial version",
];

/** Markers that revision / limitation / self-correction by the target exists. */
export const TARGET_REVISION_MARKERS = [
  "later revised", "subsequently qualified", "in later work", "went on to limit",
  "retracted", "reconsidered", "modified this view", "the mature position",
  "he later", "she later", "in the second edition", "the revised account",
];

/** Markers of reliance on secondary literature only. */
export const SECONDARY_SOURCE_MARKERS = [
  "as summarised by", "as summarized by", "according to commentators",
  "as introduced in", "the standard interpretation", "as glossed by",
  "cited in", "quoted in", "as reported by", "in the secondary literature",
  "introductory accounts", "as characterised by", "as characterized by",
  "textbook presentations",
];

/** Markers that a peripheral / occasional statement is being used. */
export const PERIPHERAL_STATEMENT_MARKERS = [
  "in an interview", "in a lecture", "once remarked", "in passing", "an aside",
  "a throwaway", "off the cuff", "in conversation", "reportedly said",
  "in a footnote", "a marginal comment", "in a blog post", "on social media",
  "a rhetorical", "merely a metaphor", "was speaking loosely",
];

/** Markers that the critic projects their OWN framework onto the target. */
export const CRITIC_CATEGORY_PROJECTION_MARKERS = [
  "must accept", "is committed to", "presupposes, whether he admits it or not",
  "cannot deny that", "is forced to concede", "by our lights", "on any reasonable",
  "obviously requires", "any serious account must", "as everyone now recognises",
  "as everyone now recognizes",
];

/** Markers that a quotation has been cut away from its surrounding conditions. */
export const CONTEXT_CUT_MARKERS = [
  "…", "[...]", "[…]", "(...)", "quoted out of context", "taken in isolation",
  "the full passage", "read in context", "the surrounding text", "elided",
  "omits the qualification", "drops the proviso", "without the caveat",
];

/** Concessive / charitable-reading markers (their presence LOWERS straw-man risk). */
export const CHARITABLE_READING_MARKERS = [
  "the strongest version", "strongest form", "most charitable", "charitably",
  "steelman", "steel-man", "on the most defensible reading", "to be fair to",
  "at its best", "the best version of", "granting the target", "even granting",
  "on its own terms", "reconstructed sympathetically", "principle of charity",
];

/** Markers of self-revision-oriented thinkers (recursive-critique methodology). */
export const SELF_REVISION_METHODOLOGY_MARKERS = [
  "self-revision", "self-correction", "recursive critique", "recursive audit",
  "reflexive method", "revisable", "conditions of revision", "his own method",
  "her own method", "applies to itself", "not exempt", "immanent critique",
  "genealogical self-application", "auto-critique",
];

/** Markers that a translated technical term is in play. */
export const TRANSLATION_MARKERS = [
  "the German ", "the French ", "the Greek ", "the original reads", "in the original",
  "often translated as", "my translation", "translator renders", "the standard translation",
  "untranslatable", "usually rendered", "the term ", "which we translate as",
];
