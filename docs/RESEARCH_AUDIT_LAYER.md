# Research-audit layer — upper-design update (Phase 1)

Status: **built, dark by default (`AUDIT_ENABLED=false`), additive migration.**
Existing repository / record / URL / DOI-display / peer-review / simulation-adapter
behaviour is unchanged.

---

## 0. What this is

An **upper-design update** to P/A Archive: alongside "deposit a record", a
researcher can **upload a research document (PDF / DOCX / Markdown / plain text)**
and the system runs a **multi-stage audit of how the document's claims are
generated** — through which categories, configuration, dependencies, history,
boundaries, scales, inference, simulation, review and institutional conditions —
and **where they could be revised**.

The system does **not** decide whether the document is true. Every analysis
result shows its grounds, inference path, referenced passage, uncertainty, and
whether it is undecidable or needs further verification, and **distinguishes AI
inference from information present in the document** (Phase 1 runs **no AI** — see
§7).

---

## 1. Pre-implementation consistency audit (required by the brief)

**Finding 1 — the "existing" ZS / address analysis / simulation / audit
mechanism referenced throughout the brief do not exist in this repository.**

| The brief assumes | `pa-archive` reality |
|---|---|
| existing ZS (Ziran System) | absent — `pa-archive` had records / versions / files / identifiers / peer review only |
| existing address / domain analysis | absent |
| existing simulation tools | absent |
| existing history-reinjection operation | absent (`audit_logs` is an operational log, not a research audit) |
| "latest version theory" | not in the repo |

The actual ZS implementation is a **separate project**,
`/Users/user/Desktop/BIM/pa-simulation-environment/` — a Vite browser app (no
dependencies, no API layer, not a package) with ~950 tests of a deliberately
non-overclaiming ZS implementation (ZCA address `<N,ID,t,s,b,v,p>`, ΩIX
category-attribution audit, `OperationMethodSpecification`, `MethodAssessmentFact`,
`DeclaredAuditScope`, …). Its own `ZIRAN_CURRENT_SPECIFICATION.md` states it is
**"not the philosophical source of truth"** — the authoritative baseline is the
**2026-09-05 ZS manuscript held privately by the project owner**.

**Consequence for this work:** re-implementing ΩIX / ZCA internals in `pa-archive`
would duplicate that audited work (violating the brief's consistency rule #1).
Instead this layer builds a **native, minimal audit-orchestration layer** that
produces findings and, where deep ZS analysis or simulation is needed, emits a
**handoff descriptor via an adapter** (stubbed now — see §9). Integration model
chosen: **native orchestration + adapters** (of: native / vendor pa-sim-env's
code / stand up a pa-sim-env API — the user expressed no preference; native keeps
`pa-archive` independent and production-safe).

---

## 2. Existing features (unchanged)

Homepage, browse/search, record deposit (draft → publish), P/A Identifiers,
DOI adapter (`local` / Crossref / DataCite), record pages, machine metadata
(JSON / JSON-LD / BibTeX / RIS / Dublin Core), citations, peer review, versioning,
corrections/retractions/withdrawal, admin console, REST API, robots/sitemap,
security hardening (CSP/HSTS/CSRF/rate-limit/audit log), the monogram branding.
**No existing route, table column, API response shape, or user flow was
modified.**

---

## 3. Added features

**Entry point** `/audit` (gated by `AUDIT_ENABLED`, `SUBMITTER`+): upload a
research document → parsed → orchestrated → audited → session page.

**Document parsing** (`lib/documents/`): `unpdf` (PDF, serverless-safe),
`mammoth` (DOCX), native (MD / TXT). Structure is *identified, never invented* —
a document with no methods section produces no `METHOD` segment. Char offsets on
every segment for passage highlighting.

**Ziran orchestration layer** (`lib/ziran/`): `planAudit(doc)` decides, per
document, **which of the 15 stages fire and why**. It is **not always-on**:
`NOT_APPLICABLE` is a recorded outcome (e.g. the simulation stage does not fire
without model-specification content; the DOI/review stage does not fire without a
DOI or record link). `SUSPENDED` / `TERMINATED` / `RECLASSIFIED` and a free-text
`customState` cover change forms outside the named set. The analytical
vocabulary (`lib/ziran/vocabulary.ts`) is stored with `revisable: true` and an
`adoptedBecause` reason — it is explicitly not a final ontology.

**The 15 stages** (`lib/research-audit/stages.ts`, `HeuristicAnalyzer`):

| # | Stage | Phase-1 implementation |
|---|---|---|
| 1 | Document structure | segment kinds, missing-section note (not generated) |
| 2 | Category extraction | watch-list match (human/AI/life/subject/…), first-use segment, `treatedAsGiven` heuristic (`null` where undetermined) |
| 3 | Category establishment | one ignition record per category; `CATEGORY_FIXATION` finding when given + constraining; boundary/scale/substitution/suspension effects recorded as `UNKNOWN` (they need a reading, not a term match) |
| 4 | Weaker operational re-reading | per strong "X is Y" statement, a weaker-vocabulary rephrasing prompt |
| 5 | Transition audit | state→state changes from transition markers; from/to parsed only where stated |
| 6 | History re-injection | references to reused prior measurements/citations/classifications/reviews/model-selections/failures/simulations/institutional-judgments; **re-injection path flagged for reading, not a provenance log** |
| 7 | Boundary & scale audit | boundary/scale-relative sentences; `Configuration C(t,s,b)` attached only where a dimension is explicit |
| 8 | Address / domain analysis | institutes/universities/companies/states/publishers/funders/grants/compute/data-infra/models/instruments/networks/regions named; **"which configuration shapes which category/access/resource/inference/evaluation/publishability", not "who is right"** |
| 9 | Claim–evidence (local) | per claim: direct/citation/data grounds, model & simulation dependency, `INSUFFICIENT_GROUNDS` when nothing within two sentences |
| 10 | DOI / review connection | matches a DOI in the text to an archive record; links peer-review status; **"has DOI"/"peer reviewed"/"highly cited" explicitly not a truth proxy** |
| 11 | Simulation possibility | detects state variables / parameters / initial & boundary conditions / transition rules / equations / predictions; emits a `SimulationCandidate` + `providerHandoff` + variations to offer (initial condition / boundary / scale / parameter / dependency removal / category substitution / counterfactual); **nothing is executed; a result would be local, not reality** |
| 12 | Counterexample / counterfactual | per claim: weakening-observation / alternative-model / definitional-vs-falsifiable prompts; detects stated falsification conditions as positive |
| 13 | Theory-mine audit | phrase patterns → over-generalisation / ontological reification / metaphor realisation / unobservable-mechanism assertion / category over-fixation / future over-specification / local→universal leap / institutional→truth; **flags are prompts, absence is not evidence of absence** |
| 14 | Regression audit (bidirectional) | within-document hedge→strong regression; **and** a `TheoryFeedback` row (`LATEST_THEORY / OPEN`) recording that the reverse check — does this document require modifying/suspending/reclassifying the current ZS theory — **cannot be done by this layer** (it has no access to the manuscript) and is owed to a human. Fitting the document to the existing theory is explicitly not the success condition. |
| 15 | Audit report | assembles **only the sections that fired**, plus a never-omitted "Undecided / needs investigation" roll-up |

**Two-layer UI** (`components/audit/workspace.tsx`):
- **Standard view** (`/audit/[id]`): Overview · Claims · Evidence · Review · Simulation · Audit · History.
- **Advanced Audit View** (`/audit/[id]/advanced`): Category Ignition · Boundary Audit / Scale Audit · Transition Audit · History Reinjection · Address / Domain Analysis · Counterfactual Audit · Theory Mine Audit · Regression Audit. Panels for stages that did not fire say so and why.
- The document body renders with the recorded ground spans highlighted; every finding has a **[jump to text]** control.

**Evaluation axes** fire per document (evidence fidelity, reproducibility,
boundary/scale sensitivity, dependency transparency, history traceability,
counterexample responsiveness, revisability). They are **text only** and are
**never summed into a single quality / scientificness / reliability / truth
score** — there is no numeric field on the model.

**AI operation log** (`audit_ai_operations`): the table exists so that *if* an
LLM analyzer is added, every operation is recorded (model / version / input /
available info / settings / time / output / downstream influence) and AI is not a
privileged subject — it is one operation kind among others. Phase 1 runs zero.

**Simulation adapter** (`lib/simulation/`): `SimulationProvider` interface (same
pattern as `IdentifierProvider`); `LocalStubProvider` produces handoff
descriptors and executes nothing. A real backend (e.g. an API over
`pa-simulation-environment`) implements `run()` and must return results marked
local to a model / input / boundary / compute environment / execution time.

---

## 4. Integrated / not-duplicated

- **ZS / ΩIX / ZCA / address analysis** — *not* re-implemented. The
  `pa-simulation-environment` implementation is the reference; this layer emits
  handoff descriptors instead of duplicating it.
- **Operational audit** — the existing `audit_logs` / `writeAudit` is reused for
  "audit session created", not forked.
- **Peer review / DOI** — stage 10 reads the existing `Identifier` / `Record`
  tables; no new review concept.
- **File storage** — reuses `lib/storage` (`getStorage`), not a new store.
- **Auth / rate limiting / CSRF / logging** — reuses `lib/auth`, `lib/api`,
  `lib/log`.

---

## 5. Weakened / removed premises

Nothing was removed. Premises deliberately **not** taken:

- "human" / "AI" / "science" / "paper" / "claim" / "evidence" / "subject" /
  "researcher" are **not primary analysis units** — they are watch-list terms
  whose *establishment* is audited (stage 3). The primary units are the weaker
  vocabulary of §3, itself marked revisable.
- ZS is **not** a top-level ontology and **not** always-on — it is an
  orchestration layer that fires operations per section.
- No "scientificness" / "quality" / "reliability" / "truth" score.
- The audit does not adjudicate truth.

---

## 6. Data model changes

Migration `20260910013559_research_audit_layer` — **additive**: 20 new
`audit_*` tables, FK constraints only on the new tables (+ two FKs from
`audit_sessions` to `users` / `records` that do not alter those tables). No
`DROP` / `ALTER COLUMN` anywhere.

Tables: `audit_sessions`, `audit_source_documents`, `audit_document_segments`,
`audit_ziran_runs`, `audit_ziran_stage_activations`, `audit_categories`,
`audit_category_ignition_records`, `audit_findings`, `audit_transition_claims`,
`audit_dependency_edges`, `audit_history_reinjections`, `audit_address_nodes`,
`audit_claim_evidence_links`, `audit_simulation_candidates`,
`audit_theory_mine_findings`, `audit_regression_findings`, `audit_theory_feedback`,
`audit_evaluation_axis_readings`, `audit_ai_operations`, `audit_reports`.

Deliberate shape choices: `kind` / `changeForm` / `axis` are `String` (the named
values in `lib/` are a revisable vocabulary); `EvaluationAxisReading` has a
`reading` text field and **no score**; every `AuditFinding` has `source`
(`DOCUMENT` / `HEURISTIC` / `AI_INFERENCE` / `MIXED`) and `groundRefs`.

---

## 7. AI-audit flow (Phase 1: none)

`lib/research-audit/analyzer.ts` defines `AuditAnalyzer`. Phase 1 ships only
`HeuristicAnalyzer` (deterministic, document-grounded) and
`LlmAnalyzerNotConfigured` (throws). When an LLM analyzer is added:

1. it must record an `AiOperation` per call,
2. every finding it emits carries `source = "AI_INFERENCE"` and a `groundRef`
   into the document (no ungrounded output),
3. its outputs are visually distinguished in the UI (source badge),
4. `AUDIT_LLM_ENABLED` + a provider key gate it; it never becomes the default.

---

## 8. Document upload → audit flow

```
POST /api/audit (multipart: file, title?)
  → createAndRunAuditSession()
     1. validate type/size (AUDIT_MAX_DOC_BYTES, default 20 MiB)
     2. parseDocument()           — unpdf / mammoth / text  → normalised text + segments
     3. store the file            — getStorage() under audit/<sessionId>/…
     4. persist SourceDocument + DocumentSegment[]
     5. DOI match                 — Identifier(type=DOI) → link Record + peerReviewStatus
     6. planAudit()               — ZiranRun + ZiranStageActivation[] (FIRED / NOT_APPLICABLE + reason)
     7. run each FIRED stage      — HeuristicAnalyzer → findings + structured rows (persisted)
     8. persistReport()           — applicable sections only + open-items roll-up
     9. status READY
  → { sessionId, url }
```

Runs synchronously (Phase 1, small documents; `maxDuration = 60`). Larger
documents / an LLM analyzer would move this to a queue.

---

## 9. Simulation connection

`SimulationCandidate.providerHandoff` is a descriptor only. To wire a real
backend: implement `SimulationProvider` (`lib/simulation/index.ts`) — likely an
HTTP client for a future API in front of `pa-simulation-environment` — and have
`run()` return `SimulationResult` whose `locality` field states the model /
input / boundary / compute environment / execution time the result is local to.
No UI or schema change is required to add it.

---

## 10. DOI / review connection

Stage 10 extracts a `10.xxxx/…` string from the document text and looks it up in
`Identifier` (`type = DOI`). On a match it links the `AuditSession.recordId`, and
the Review tab shows the record and its peer-review status. The finding text
states plainly that DOI / peer-review / citation counts are **not** truth
proxies. No change to the DOI adapter or the review pages.

---

## 11. Migration policy

- Local: `npm run prisma:migrate`.
- Production: `npx prisma migrate deploy` (never `db push`). This migration is
  additive; take the normal pre-migration backup.
- `AUDIT_ENABLED` stays `false` in production until the layer is reviewed —
  routes 404, no nav link, no API.

Env added: `AUDIT_ENABLED` (default `false`), `AUDIT_MAX_DOC_BYTES` (default
`20971520`), `AUDIT_LLM_ENABLED` (default `false`, unused in Phase 1).

---

## 12. Regression audit (of this implementation)

- **Did equivalent functionality already exist?** ZS / address / simulation /
  history-reinjection: yes, in `pa-simulation-environment` — *not* duplicated
  here (handoff instead). Operational audit / storage / auth / DOI / review:
  yes, in `pa-archive` — reused, not forked.
- **Were "human" / "AI" / "science" / "claim" / "evidence" returned to primary
  units?** No — they are watch-list terms audited for establishment; the primary
  vocabulary is the weaker set, marked revisable.
- **Was the current vocabulary turned into a new universal ontology?** No —
  `ANALYTICAL_VOCABULARY` entries all carry `revisable: true`; `Configuration
  C(t,s,b)` is used only where a dimension is explicit; the stage list itself is
  declared as revisable.
- **Did it regress to AI summary / AI review / citation graph / knowledge graph /
  provenance management / PDF chat / paper scoring?** No AI runs; there is no
  citation/knowledge graph; history-reinjection is explicitly *not* a provenance
  log; there is no score of any kind; there is no chat surface.

## 13. Counterexamples / modifications owed to the current ("latest") ZS theory

This layer cannot see the 2026-09-05 ZS manuscript, so it cannot perform the
reverse audit. What the *implementation process* surfaced, for a human to check
against the manuscript:

1. **"Category Ignition / Suspension / Termination / Reclassification" as the
   change-form set.** The brief itself says not to fix this as exhaustive. The
   schema honours that (`customForm` / `customState` free text), but if the
   manuscript's ΩIX has a settled larger set, the named enum values here should
   be reconciled with it rather than treated as canonical.
2. **"History re-injection" as a stage vs. a ZS operation.** Implemented here as
   a heuristic detector feeding a stage. If the manuscript defines it as a
   first-class ZS operation with its own address/version semantics (as
   `pa-simulation-environment`'s ΩIX work suggests for other operations), this
   stage should become a thin front-end over that, not a parallel concept.
3. **`Configuration C(t,s,b)`** is modelled here as `{ timeInterval?, scale?,
   boundary?, specified }`. `pa-simulation-environment`'s ZCA uses
   `<N, ID, t, s, b, v, p>` (with namespace, id, version, provenance). If C and
   ZCA are meant to be the same addressing responsibility, this three-field
   shape is a lossy subset and should adopt the ZCA shape.
4. **The bidirectional audit is recorded as permanently OPEN.** That is correct
   for Phase 1 but is itself a gap the manuscript-holder must close — the audit
   is only half-built until the reverse direction runs.
