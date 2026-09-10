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
