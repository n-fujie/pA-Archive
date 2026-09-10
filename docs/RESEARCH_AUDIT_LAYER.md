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

**The 16 stages** (`lib/research-audit/stages.ts`, `HeuristicAnalyzer`):

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
| 15 | Straw-man risk / target-understanding audit | **conditional** — fires only when the document criticises / rebuts / negatively evaluates / points out limitations of / claims comparative superiority over a *specific* person, theory, school, thought-system, scientific model, or research programme (`detectCriticismTargets`). Audits whether the target was reconstructed at its strongest **before** being criticised — not whether the criticism is right. See §14a. |
| 16 | Audit report | assembles **only the sections that fired**, plus a never-omitted "Undecided / needs investigation" roll-up |

**Two-layer UI** (`components/audit/workspace.tsx`):
- **Standard view** (`/audit/[id]`): Overview · Claims · Evidence · Review · Simulation · Audit · History.
- **Advanced Audit View** (`/audit/[id]/advanced`): Category Ignition · Boundary Audit / Scale Audit · Transition Audit · History Reinjection · Address / Domain Analysis · Counterfactual Audit · Theory Mine Audit · Regression Audit · Straw-Man Risk Audit. Panels for stages that did not fire say so and why.
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

Migration `20260910020734_straw_man_risk_audit` — **additive**: adds the enum
value `AuditStage.STRAW_MAN_RISK` and one table `audit_straw_man_risk_audits`
(one row per criticised target; six dimension columns default `"UNDETERMINED"`,
`riskTypes String[]`, text output columns, `fiveStage Json`,
`understandingInsufficientConcern Boolean`, FK to `audit_sessions` only). No
`DROP` / `ALTER COLUMN`.

Migration `20260910030427_straw_man_risk_audit_phase2` — **additive**: six new
columns on `audit_straw_man_risk_audits` via `ADD COLUMN … DEFAULT`
(`targetIdentity Jsonb '{}'`, `targetVersionResolved bool false`,
`evidencePresence Jsonb '{}'`, `verificationStatus text 'DOCUMENT_ONLY'`,
`critiqueSurvival text 'UNDETERMINED'`, `comparativeSuperiorityUnverified bool false`).
No `DROP` / `ALTER COLUMN` / enum change. Rows written by `5e8ca76` back-fill to
the defaults and remain readable.

Tables: `audit_sessions`, `audit_source_documents`, `audit_document_segments`,
`audit_ziran_runs`, `audit_ziran_stage_activations`, `audit_categories`,
`audit_category_ignition_records`, `audit_findings`, `audit_transition_claims`,
`audit_dependency_edges`, `audit_history_reinjections`, `audit_address_nodes`,
`audit_claim_evidence_links`, `audit_simulation_candidates`,
`audit_theory_mine_findings`, `audit_regression_findings`, `audit_theory_feedback`,
`audit_evaluation_axis_readings`, `audit_ai_operations`, `audit_reports`, and
(second migration) `audit_straw_man_risk_audits`.

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
- Production: `npx prisma migrate deploy` (never `db push`). All audit-layer
  migrations (`20260910013559_research_audit_layer`,
  `20260910020734_straw_man_risk_audit`,
  `20260910030427_straw_man_risk_audit_phase2`) are additive; take the normal
  pre-migration backup.
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

## 14a. Straw-Man Risk / Target-Understanding audit (stage 15)

**When it fires.** `analyzeCriticismSignals` + `detectCriticismTargets`
(`lib/research-audit/straw-man.ts`) require both (a) *evaluative* criticism —
limitation / inadequacy / rejection / correction / comparative-deficiency
(`CRITICISM_MARKERS`, `COMPARATIVE_SUPERIORITY_MARKERS`); neutral comparison
(`NEUTRAL_COMPARISON_MARKERS` — "unlike", "in contrast to"), neutral attribution
(`NEUTRAL_ATTRIBUTION_MARKERS` — "we extend", "drawing on"), plain historical
description ("X's view changed across his career"), and a *negated* criticism verb
("nothing turns on criticising X") do **not** fire — and (b) at least one *specific*
target: a person ("X argues / X's account / criticise X"), a named system ("the X
theory / the 1986 X model"), the object of a superiority claim ("goes beyond the
standard X account"), an `-ism` (with owner: "Brandom's inferentialism"), or an
"X's theory of Y". No evaluative criticism, or no identifiable target → the stage
is `NOT_APPLICABLE` with the reason.

**What it audits.** Not whether the criticism is correct — whether the target has
been *identified and reconstructed with enough fidelity for the criticism to count
as a completed criticism* rather than a potentially weak reconstruction. Straw-man
detection: target simplified, fixated at an old version, weakened, stripped of its
own limiting conditions, or (Phase 2) criticised as an undifferentiated name when
the document itself makes a version/period distinction available.

### Phase 2 — epistemic conservatism (commit after `5e8ca76`)

The heuristic layer must not pretend to know more about a target than the document
permits. Three things are recorded **separately** and never conflated:

| field | question |
|---|---|
| `evidencePresence` (JSON) | *What material is in the submission?* — mechanical booleans: criticism phrase, direct quotation, citation near criticism, named primary work, publication year/version, page/section locator, target-position reconstruction, qualification acknowledged, later-development discussed, strongest-version reconstruction. Each carries a `groundRef`. |
| `verificationStatus` | *Was that material actually checked?* — `DOCUMENT_ONLY` / `PRIMARY_EVIDENCE_PRESENT_UNVERIFIED` / `VERIFICATION_INSUFFICIENT`. The heuristic layer **never** reaches `EXTERNALLY_VERIFIED`. |
| six dimensions + `riskTypes` | *Given the above, how risky is the reconstruction?* |

**A citation is evidence that checking may have occurred — not that it was
correct.** So the heuristic layer **never emits `低リスク` (`LOW_RISK`)** on any
dimension (a `dimNoLow` safety net enforces this): the best a marker-only pass
returns is `要確認`; genuinely ambiguous → `判定不能`; a straw-man indicator → `高リスク`.
The absence of evidence may justify a risk warning; the presence of citations may
not by itself justify confidence.

**Target-version identity** (`targetIdentity` JSON: `canonicalName`, `targetKind`
∈ PERSON/WORK/THEORY/MODEL/PROGRAMME/SCHOOL/ISM/OTHER, `workTitle?`,
`publicationYear?`, `editionOrVersion?`, `periodLabel?`, `explicitlyTemporal`).
Extracted only from document-grounded cues tightly bound to a mention ("early
Foucault", "in his early work, X", "X (1993)", "X in \"Work\"", "revised edition").
A canonical name whose mentions carry **distinct** period/work signatures is
**split into separate targets** ("early Sellars" vs "account of picturing") — no
cross-version contamination. When no version cue exists the generic target is kept
with `targetVersionResolved = false` and the grounds carry `TARGET_VERSION_UNRESOLVED`.
A universal claim about the bare name while only one phase is engaged →
`temporalOvergeneralisation` → risk type `旧版固定型` + note
「一時期の記述を対象全体へ一般化している可能性」. Bare person names fold into a richer
same-person target (their `-ism` / theory / work) **unless** the richer target
carries a period/work identity the bare mention lacks.

**Recursive self-revision** (`recursiveSelfApplicationNote`) — operational when the
target is `explicitlyTemporal`, or self-revision / historical-change language is
present: five questions (which version is criticised? is the criticism restricted
to it? is a later self-correction ignored? is a later position projected backward?
is an early position treated as permanent?). Uses only
「時期区分の確認が必要」/「対象の後期立場との整合性は未確認」/
「当該批判がどの時期の立場を対象としているか不明」— never "X later abandoned this",
"X failed to consider", "X's real position is".

**`critiqueSurvival`** (NOT a seventh score) — `CRITIQUE_NOT_YET_TESTED_AGAINST_STRONGEST_TARGET`
(default) / `CRITIQUE_REQUIRES_REFORMULATION` (≥2 HIGH_RISK dims + understanding
concern) / `CRITIQUE_APPEARS_STRUCTURALLY_PRESERVABLE` (narrow objection +
strongest-version reconstruction + zero risk types — rare under heuristic
analysis) / `UNDETERMINED`.

**Comparative superiority** — `comparativeSuperiorityUnverified` is set only when a
superiority marker and the target sit in the **same sentence**; the grounds then
carry 「比較優位主張は検出されたが、比較対象の最大強度版との照合が必要」and the audit
never endorses the superiority claim. At **report-assembly** time
(`persistReport`) any such row produces a `NOVELTY_GUARD` section:
「比較対象理解が未確定のため、この差分を新規性の確定根拠として使用しない」— so a
downstream "new / beyond X" claim is not treated as established novelty while the
target-understanding risk is open. (No cyclic pipeline dependency — the two
signals meet in the report.)

**Five-stage scaffold** — when stages 2–4 (Target Position / Primary Evidence /
Strongest Reconstruction) cannot be filled from the document they are **not
fabricated**: they read 「未確定。対象自身による限定・例外・後期修正の一次文献確認が必要。」

**Grounding at every level** — each row's `groundRefs` carries multiple entries
with a `role`: `target-mention`, `criticism-phrase`, `temporal-qualification`,
`publication-year`, `work-version-marker`, `quotation`, `reconstruction-passage`.
`GroundRef.role` is an optional field (older rows omit it).

**Known limitation** — a comparative claim whose object is a lowercase phrase with
no proper-noun head and no `account/view/model/...` descriptor may not be extracted
as a target; the superiority claim then goes unaudited.

**Ten audit items** drive six **independently-displayed** dimensions — never summed:

| dimension (stored slug) | 低リスク / 要確認 / 高リスク / 判定不能 |
|---|---|
| 一次文献理解 `primaryLiterature` | primary works cited, or only secondary literature / intros / summaries? |
| 最新立場整合性 `latestPositionAlignment` | latest/mature position, or an early formulation the target later revised (`旧版固定型`)? |
| 既処理論点見落とし `alreadyProcessedPoints` | has the target already limited / processed / self-corrected the point? ("does not consider X" language → 高リスク) |
| 強い版への応答 `strongVersionResponse` | critique against the strongest reconstructible version, not the weakest reading (`過度単純化型`)? |
| 中心命題代表性 `centralPropositionRepr` | a central proposition, or a peripheral interview / lecture / footnote remark (`周辺命題代表化型`)? |
| 概念位置の正確性 `conceptLevelAccuracy` | concept level (ontological / methodological / normative / functional / metaphorical / historical / analytical) not conflated; critic's own categories not projected onto the target (`批判者側カテゴリー投射型`) |

**Risk types** (`riskTypes`, 0+): 対象理解不足型 / 一次文献不足型 / 旧版固定型 /
既処理論点見落とし型 / 過度単純化型 / 周辺命題代表化型 / 文脈切断型 / 概念水準混同型 /
翻訳変形型 / 批判者側カテゴリー投射型 / 帰属不能命題型.

**Outputs per target**: 主要な藁人形化リスク · 根拠 · 対象側のより強い再構成 ·
批判を維持したまま修正する方法 · a 5-stage scaffold (Claim / Target Position /
Primary Evidence / Strongest Reconstruction / Critique) · `recursiveSelfApplicationNote`
(for self-revising thinkers, the limits of re-applying the target's own method to
the target's own central vocabulary).

**Revision principle (encoded in the copy, not a gate).** Detecting straw-man risk
does **not** auto-reject the criticism: reconstruct the target stronger and more
accurate first, then re-evaluate whether the criticism still holds. When target
understanding is insufficient the stage must **not** assert "the target does not
consider this problem" — the finding text is limited to
「一次文献上の確認が不足している」/「現在確認できる範囲では十分に処理されていない」/
「対象の最新立場の確認が必要」, and `understandingInsufficientConcern = true` sets the
finding kind to `STRAW_MAN_RISK_UNDERSTANDING_INSUFFICIENT` with the banner
「対象理解不足による藁人形化懸念」— the criticism is **not** approved as complete.

**Model**: `audit_straw_man_risk_audits` (one row per target; Phase 2 adds
`targetIdentity`, `targetVersionResolved`, `evidencePresence`, `verificationStatus`,
`critiqueSurvival`, `comparativeSuperiorityUnverified` — all additive, all
defaulted, so rows from `5e8ca76` still load). `EvaluationAxisReading` axis
`TARGET_UNDERSTANDING` is text only. UI: Advanced view → "Straw-Man Risk Audit"
panel (per-target cards: target identity, TARGET_VERSION_UNRESOLVED warning,
evidence-present list, verification / critique-survival badges, the six dimension
badges, risk types, the narrative fields, the 5-stage scaffold) + Standard "Audit"
tab.

**Phase 1/2 is heuristic.** It matches marker lexicons, citation shapes and
version cues; it cannot read the primary literature. A future LLM analyzer would
fill the 5-stage reconstruction and move `verificationStatus` past
`PRIMARY_EVIDENCE_PRESENT_UNVERIFIED` with actual primary-source content (source
`AI_INFERENCE`, grounded) — only that layer may emit `低リスク`.

---

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
