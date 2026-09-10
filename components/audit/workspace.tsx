"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { AuditSessionView } from "@/lib/research-audit/load";
import { FindingCard } from "./finding-card";

type Mode = "standard" | "advanced";

const STANDARD_TABS = [
  { key: "overview", label: "Overview" },
  { key: "claims", label: "Claims" },
  { key: "evidence", label: "Evidence" },
  { key: "review", label: "Review" },
  { key: "simulation", label: "Simulation" },
  { key: "audit", label: "Audit" },
  { key: "history", label: "History" },
] as const;

const ADVANCED_PANELS = [
  { key: "CATEGORY_IGNITION", label: "Category Ignition" },
  { key: "BOUNDARY_SCALE", label: "Boundary Audit / Scale Audit" },
  { key: "TRANSITION", label: "Transition Audit" },
  { key: "HISTORY_REINJECTION", label: "History Reinjection" },
  { key: "ADDRESS_DOMAIN", label: "Address / Domain Analysis" },
  { key: "COUNTERFACTUAL", label: "Counterfactual Audit" },
  { key: "THEORY_MINE", label: "Theory Mine Audit" },
  { key: "REGRESSION", label: "Regression Audit" },
  { key: "STRAW_MAN_RISK", label: "Straw-Man Risk Audit" },
] as const;

const RISK_VERDICT: Record<string, { label: string; cls: string }> = {
  LOW_RISK: { label: "低リスク", cls: "badge-review" },
  NEEDS_CHECK: { label: "要確認", cls: "badge-warn" },
  HIGH_RISK: { label: "高リスク", cls: "badge-danger" },
  UNDETERMINED: { label: "判定不能", cls: "badge-doi" },
};

const STRAW_MAN_DIMENSIONS: { key: string; label: string }[] = [
  { key: "primaryLiterature", label: "一次文献理解" },
  { key: "latestPositionAlignment", label: "最新立場整合性" },
  { key: "alreadyProcessedPoints", label: "既処理論点見落とし" },
  { key: "strongVersionResponse", label: "強い版への応答" },
  { key: "centralPropositionRepr", label: "中心命題代表性" },
  { key: "conceptLevelAccuracy", label: "概念位置の正確性" },
];

export function AuditWorkspace({ view, mode }: { view: AuditSessionView; mode: Mode }) {
  const text = view.document?.text ?? "";
  const [tab, setTab] = useState<string>(mode === "standard" ? "overview" : "CATEGORY_IGNITION");
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const markRef = useRef<HTMLSpanElement | null>(null);

  // all ground spans, for passive highlighting
  const spans = useMemo(() => {
    const acc: { start: number; end: number }[] = [];
    for (const f of view.allFindings) for (const g of f.groundRefs) acc.push({ start: g.charStart, end: g.charEnd });
    return acc.sort((a, b) => a.start - b.start);
  }, [view.allFindings]);

  const jump = (start: number, end: number) => {
    setRange({ start, end });
    setTimeout(() => markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
  };

  const rendered = useMemo(() => renderText(text, spans, range), [text, spans, range]);

  const findingsFor = (stages: string[]) => view.allFindings.filter((f) => stages.includes(f.stage));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      {/* document panel */}
      <div className="order-2 lg:order-1">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          <span>{view.document?.originalName}</span>
          <span className="font-mono">{view.document?.wordCount ?? 0} words · {view.document?.parser}</span>
        </div>
        <div className="card max-h-[70vh] overflow-y-auto p-4 text-[13px] leading-6 text-ink-soft">
          <pre className="whitespace-pre-wrap font-sans">
            {rendered.map((chunk, i) =>
              chunk.mark ? (
                <span
                  key={i}
                  ref={chunk.active ? markRef : undefined}
                  className={chunk.active ? "rounded-sm bg-warn/30 px-0.5" : "rounded-sm bg-navy/10"}
                >
                  {chunk.t}
                </span>
              ) : (
                <span key={i}>{chunk.t}</span>
              ),
            )}
          </pre>
        </div>
        <p className="field-hint">
          Highlighted spans are the recorded grounds of audit findings. Click “jump to text” on a finding to focus one.
        </p>
      </div>

      {/* audit panel */}
      <div className="order-1 lg:order-2">
        <nav className="flex flex-wrap gap-1 border-b border-rule pb-2 text-sm">
          {(mode === "standard" ? STANDARD_TABS : ADVANCED_PANELS).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`btn !px-2 !py-1 !text-xs ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-3 space-y-3">
          {mode === "standard" ? (
            <StandardPanel tab={tab} view={view} jump={jump} findingsFor={findingsFor} />
          ) : (
            <AdvancedPanel tab={tab} view={view} jump={jump} findingsFor={findingsFor} />
          )}
        </div>

        <div className="mt-4 border-t border-rule pt-3 text-xs">
          {mode === "standard" ? (
            <Link href={`/audit/${view.id}/advanced`}>Advanced Audit View →</Link>
          ) : (
            <Link href={`/audit/${view.id}`}>← Standard view</Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StandardPanel({
  tab,
  view,
  jump,
  findingsFor,
}: {
  tab: string;
  view: AuditSessionView;
  jump: (s: number, e: number) => void;
  findingsFor: (stages: string[]) => AuditSessionView["allFindings"];
}) {
  if (tab === "overview") {
    const report = view.report as { key: string; n: number; title: string; body: string }[];
    return (
      <div className="space-y-3 text-sm">
        <p className="text-ink-soft">
          This page audits how the document&apos;s claims are generated — through which categories, configuration,
          dependencies, history, boundaries, scales, inference, simulation, review and institutional conditions, and
          where they could be revised. It does not decide whether the document is true.
        </p>
        <div className="card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Orchestration (Ziran layer)</p>
          <p className="mt-1 text-xs text-ink-muted">{view.ziran?.planNote}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {view.ziran?.activations.map((a) => (
              <li key={a.stage} className="flex gap-2">
                <span className={`badge ${a.state === "FIRED" ? "badge-review" : "badge-doi"}`}>{a.state.toLowerCase()}</span>
                <span>
                  <strong>{a.stageNumber}. {a.stageLabel}</strong> — {a.reason}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-faint">{view.ziran?.vocabularyNote}</p>
        </div>
        {report.filter((r) => r.title).map((r) => (
          <div key={r.key} className="card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {r.n ? `${r.n}. ` : ""}{r.title}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{r.body}</p>
          </div>
        ))}
        <EvalAxes view={view} />
      </div>
    );
  }
  if (tab === "claims") {
    return (
      <div className="space-y-3">
        {view.claimEvidence.length === 0 && <Empty>No explicit claims were located.</Empty>}
        {view.claimEvidence.map((c) => (
          <article key={c.id} className="card p-3 text-sm">
            <p className="font-medium">{c.claimText}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
              <li>direct grounds: {(c.directGroundRefs as unknown[]).length}</li>
              <li>citation grounds: {(c.citationGroundRefs as unknown[]).length}</li>
              <li>data grounds: {(c.dataGroundRefs as unknown[]).length}</li>
              {c.modelDependencyText && <li>model dependency: {c.modelDependencyText}</li>}
              {c.simulationDependencyText && <li>simulation dependency: {c.simulationDependencyText}</li>}
              {c.inferenceCompletionText && <li className="text-warn">{c.inferenceCompletionText}</li>}
            </ul>
          </article>
        ))}
      </div>
    );
  }
  if (tab === "evidence") {
    return <FindingList findings={findingsFor(["CLAIM_EVIDENCE", "STRUCTURE"])} jump={jump} empty="No evidence-stage findings." />;
  }
  if (tab === "review") {
    return (
      <div className="space-y-3 text-sm">
        {view.recordSlug ? (
          <div className="card p-3">
            <p>
              Linked archive record: <Link href={`/records/${view.recordSlug}`}>{view.recordSlug}</Link>
            </p>
            <p className="mt-1 text-xs text-ink-muted">Peer-review status: {view.peerReviewStatus?.replace(/_/g, " ").toLowerCase() ?? "—"}</p>
          </div>
        ) : (
          <Empty>No archive record / DOI connection.</Empty>
        )}
        <p className="text-xs text-ink-faint">
          &quot;Has a DOI&quot;, &quot;peer reviewed&quot; and &quot;highly cited&quot; are not treated as proxies for truth or reliability.
        </p>
        <FindingList findings={findingsFor(["DOI_REVIEW"])} jump={jump} empty="" />
      </div>
    );
  }
  if (tab === "simulation") {
    return (
      <div className="space-y-3">
        {view.simulationCandidates.length === 0 && <Empty>No simulation candidate was extracted.</Empty>}
        {view.simulationCandidates.map((s) => (
          <article key={s.id} className="card p-3 text-sm">
            <p>{s.description}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Variations offerable: {(s.varyableInputs as string[]).join(", ")}
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">
              Nothing is executed. Any result would be local to a model, input, boundary, compute environment and execution time — not reality.
            </p>
          </article>
        ))}
        <FindingList findings={findingsFor(["SIMULATION"])} jump={jump} empty="" />
      </div>
    );
  }
  if (tab === "audit") {
    return <FindingList findings={findingsFor(["CATEGORIES", "CATEGORY_IGNITION", "WEAK_OPERATIONAL", "THEORY_MINE", "COUNTERFACTUAL", "REGRESSION", "STRAW_MAN_RISK"])} jump={jump} empty="No audit-stage findings." />;
  }
  if (tab === "history") {
    return (
      <div className="space-y-3">
        {view.historyReinjections.length === 0 && <Empty>No reused prior operations were detected.</Empty>}
        {view.historyReinjections.map((h) => (
          <article key={h.id} className="card p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{h.pastKind.replace(/_/g, " ").toLowerCase()}</p>
            <p className="mt-1">{h.pastDescription}</p>
            <p className="mt-1 text-xs text-ink-muted">{h.reinjectionDescription}</p>
          </article>
        ))}
      </div>
    );
  }
  return null;
}

function AdvancedPanel({
  tab,
  view,
  jump,
  findingsFor,
}: {
  tab: string;
  view: AuditSessionView;
  jump: (s: number, e: number) => void;
  findingsFor: (stages: string[]) => AuditSessionView["allFindings"];
}) {
  if (tab === "CATEGORY_IGNITION") {
    return (
      <div className="space-y-3">
        {view.categories.length === 0 && <Empty>No categories extracted.</Empty>}
        {view.categories.map((c) => (
          <article key={c.id} className="card p-3 text-sm">
            <p className="font-medium">
              {c.term}{" "}
              <span className="text-xs text-ink-muted">
                {c.treatedAsGiven === true ? "· treated as given" : c.treatedAsGiven === false ? "· establishment conditions present" : "· given/established undetermined"}
              </span>
            </p>
            <p className="text-xs text-ink-muted">constrains subsequent inference: {c.constrainsSubsequent.toLowerCase()}</p>
            {c.establishmentConditions && <p className="mt-1 text-xs text-ink-soft">{c.establishmentConditions}</p>}
            {c.ignition.map((ig, i) => (
              <ul key={i} className="mt-1 grid grid-cols-2 gap-x-3 text-[11px] text-ink-faint">
                <li>change form: {ig.changeForm.toLowerCase()}</li>
                <li>persists under boundary change: {ig.persistsUnderBoundaryChange.toLowerCase()}</li>
                <li>persists under scale change: {ig.persistsUnderScaleChange.toLowerCase()}</li>
                <li>substitution changes inference: {ig.substitutionChangesInference.toLowerCase()}</li>
                <li>analysis holds if suspended: {ig.analysisHoldsIfSuspended.toLowerCase()}</li>
              </ul>
            ))}
          </article>
        ))}
        <FindingList findings={findingsFor(["CATEGORY_IGNITION", "CATEGORIES"])} jump={jump} empty="" />
      </div>
    );
  }
  if (tab === "BOUNDARY_SCALE") return <FindingList findings={findingsFor(["BOUNDARY_SCALE"])} jump={jump} empty="Boundary/scale audit did not fire — nothing boundary- or scale-relative was found." />;
  if (tab === "TRANSITION") {
    return (
      <div className="space-y-3">
        {view.transitions.length === 0 && <Empty>Transition audit did not fire — no state-change language.</Empty>}
        {view.transitions.map((t) => (
          <article key={t.id} className="card p-3 text-sm">
            <p><strong>{t.fromState}</strong> → <strong>{t.toState}</strong></p>
            {t.enablingConditions && <p className="text-xs text-ink-muted">enabling: {t.enablingConditions}</p>}
            {t.disablingConditions && <p className="text-xs text-ink-muted">disabling: {t.disablingConditions}</p>}
            <p className="mt-1 text-[11px] text-ink-faint">{t.conditionSensitivity}</p>
          </article>
        ))}
      </div>
    );
  }
  if (tab === "HISTORY_REINJECTION") return <FindingList findings={findingsFor(["HISTORY_REINJECTION"])} jump={jump} empty="History-reinjection audit did not fire." />;
  if (tab === "ADDRESS_DOMAIN") {
    return (
      <div className="space-y-3">
        {view.addressNodes.length === 0 && <Empty>Address/domain analysis did not fire — no institutional or material configuration named.</Empty>}
        {view.addressNodes.map((n) => (
          <article key={n.id} className="card p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{n.kind.replace(/_/g, " ").toLowerCase()}</p>
            <p className="mt-1 font-medium">{n.label}</p>
            <p className="mt-1 text-xs text-ink-muted">{n.roleInGeneration}</p>
          </article>
        ))}
      </div>
    );
  }
  if (tab === "COUNTERFACTUAL") return <FindingList findings={findingsFor(["COUNTERFACTUAL"])} jump={jump} empty="Counterfactual audit did not fire — no explicit claims to probe." />;
  if (tab === "THEORY_MINE") {
    return (
      <div className="space-y-3">
        {view.theoryMines.length === 0 && <Empty>No theory-mine phrase patterns matched. This is not evidence of absence.</Empty>}
        {view.theoryMines.map((m) => (
          <article key={m.id} className="card p-3 text-sm">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="badge badge-warn">{m.mineKind.replace(/_/g, " ").toLowerCase()}</span>
              <span className="badge badge-danger">{m.severity.toLowerCase()}</span>
            </div>
            <p className="mt-1">{m.claimText}</p>
            <p className="mt-1 text-xs text-ink-muted">{m.reason}</p>
          </article>
        ))}
      </div>
    );
  }
  if (tab === "STRAW_MAN_RISK") {
    const audits = view.strawManRiskAudits;
    const activation = view.ziran?.activations.find((a) => a.stage === "STRAW_MAN_RISK");
    return (
      <div className="space-y-3">
        <div className="card p-3 text-xs text-ink-muted">
          <p>
            Conditional stage. Fires only when the document criticises / rebuts / negatively evaluates / points out
            limitations of / claims comparative superiority over a specific person, theory, school, thought-system,
            scientific model, or research programme.
          </p>
          {activation && (
            <p className="mt-1">
              <span className={`badge ${activation.state === "FIRED" ? "badge-review" : "badge-doi"}`}>
                {activation.state.toLowerCase()}
              </span>{" "}
              {activation.reason}
            </p>
          )}
          <p className="mt-1 text-[11px] text-ink-faint">
            This audit does not judge whether the criticism is right. It checks whether the target was reconstructed at
            its strongest before being criticised. The six dimensions are shown independently and are never summed into a
            score.
          </p>
        </div>
        {audits.length === 0 && <Empty>Straw-man risk audit did not fire, or isolated no specific criticised target.</Empty>}
        {audits.map((a) => {
          const id = a.targetIdentity as Record<string, unknown>;
          const idParts = [
            id.periodLabel ? `period: ${String(id.periodLabel)}` : null,
            id.workTitle ? `work: ${String(id.workTitle)}` : null,
            id.editionOrVersion ? `version: ${String(id.editionOrVersion)}` : null,
            id.publicationYear ? `year: ${String(id.publicationYear)}` : null,
          ].filter(Boolean) as string[];
          const evPresent = Object.entries(a.evidencePresence)
            .filter(([, v]) => v)
            .map(([k]) => k);
          return (
          <article key={a.id} className="card space-y-2 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-doi">{a.targetKind.replace(/_/g, " ").toLowerCase()}</span>
              <p className="font-medium">{a.targetLabel}</p>
            </div>

            {idParts.length > 0 ? (
              <p className="text-[11px] text-ink-muted">target identity — {idParts.join(" · ")}</p>
            ) : null}
            {!a.targetVersionResolved && (
              <p className="rounded-sm border border-warn/40 bg-warn/5 p-2 text-[11px] text-warn">
                TARGET_VERSION_UNRESOLVED — 当該批判がどの時期/版の立場を対象としているか不明。時期区分の確認が必要。
              </p>
            )}

            <p className="text-xs text-ink-soft">{a.criticismSummary}</p>

            {a.understandingInsufficientConcern && (
              <p className="rounded-sm border border-danger/40 bg-danger/5 p-2 text-xs font-semibold text-danger">
                対象理解不足による藁人形化懸念 — この批判は「完結した批判」として承認しない。まず一次文献から対象を再構成すること。
              </p>
            )}
            {a.comparativeSuperiorityUnverified && (
              <p className="rounded-sm border border-warn/40 bg-warn/5 p-2 text-[11px] text-warn">
                比較優位主張は検出されたが、比較対象の最大強度版との照合が必要（優位主張自体は承認しない）。
              </p>
            )}

            <div className="flex flex-wrap gap-2 text-[11px] text-ink-muted">
              <span>evidence present: {evPresent.length > 0 ? evPresent.join(", ") : "（なし）"}</span>
            </div>
            <div className="flex flex-wrap gap-1 text-[11px]">
              <span className="badge badge-doi">verification: {a.verificationStatus.toLowerCase()}</span>
              <span className="badge badge-doi">critique: {a.critiqueSurvival.replace(/_/g, " ").toLowerCase()}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {STRAW_MAN_DIMENSIONS.map((d) => {
                const v = (a.dimensions as Record<string, string>)[d.key] ?? "UNDETERMINED";
                const verdict = RISK_VERDICT[v] ?? RISK_VERDICT.UNDETERMINED;
                return (
                  <div key={d.key} className="flex items-center justify-between gap-1 rounded-sm border border-rule px-2 py-1 text-[11px]">
                    <span className="text-ink-muted">{d.label}</span>
                    <span className={`badge ${verdict.cls}`}>{verdict.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-ink-faint">
              ヒューリスティック層は「低リスク」を出力しない。引用の存在は照合が行われた可能性の証拠であって、照合が正しかった証拠ではない。
            </p>

            {a.riskTypes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {a.riskTypes.map((rt) => (
                  <span key={rt} className="badge badge-warn text-[11px]">{rt}</span>
                ))}
              </div>
            )}

            <Field label="主要な藁人形化リスク" value={a.mainStrawManRisk} />
            <Field label="根拠" value={a.grounds} />
            <Field label="対象側のより強い再構成" value={a.strongerReconstruction} />
            <Field label="批判を維持したまま修正する方法" value={a.reviseWhileKeepingCritique} />

            {a.recursiveSelfApplicationNote && (
              <Field label="自己修正的対象への批判：時期/版の確認" value={a.recursiveSelfApplicationNote} />
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-ink-muted">5段階再構成 (Claim / Target Position / Primary Evidence / Strongest Reconstruction / Critique)</summary>
              <ul className="mt-1 space-y-1 text-ink-soft">
                {["claim", "targetPosition", "primaryEvidence", "strongestReconstruction", "critique"].map((k) => (
                  <li key={k}>
                    <strong>{k}:</strong> {String((a.fiveStage as Record<string, unknown>)[k] ?? "—")}
                  </li>
                ))}
              </ul>
            </details>
          </article>
          );
        })}
        <FindingList findings={findingsFor(["STRAW_MAN_RISK"])} jump={jump} empty="" />
      </div>
    );
  }
  if (tab === "REGRESSION") {
    return (
      <div className="space-y-3">
        <FindingList findings={findingsFor(["REGRESSION"])} jump={jump} empty="No within-document regression flagged." />
        {view.theoryFeedback.length > 0 && (
          <div className="card border-warn/40 bg-warn/5 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-warn">Bidirectional — existing theory audited by this object</p>
            {view.theoryFeedback.map((tf) => (
              <div key={tf.id} className="mt-1">
                <p className="text-xs text-ink-muted">
                  target: {tf.targetLayer.replace(/_/g, " ").toLowerCase()} · proposed: {tf.proposedChange.toLowerCase()} · status: {tf.status.toLowerCase()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{tf.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
}

function FindingList({
  findings,
  jump,
  empty,
}: {
  findings: AuditSessionView["allFindings"];
  jump: (s: number, e: number) => void;
  empty: string;
}) {
  if (findings.length === 0) return empty ? <Empty>{empty}</Empty> : null;
  return (
    <div className="space-y-3">
      {findings.map((f) => (
        <FindingCard key={f.id} finding={f} onJump={jump} />
      ))}
    </div>
  );
}

function EvalAxes({ view }: { view: AuditSessionView }) {
  if (view.evaluationAxes.length === 0) return null;
  return (
    <div className="card p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Evaluation axes (fired for this document)</p>
      <ul className="mt-2 space-y-1 text-xs">
        {view.evaluationAxes.filter((a) => a.fired).map((a) => (
          <li key={a.axis}>
            <strong>{a.axis.replace(/_/g, " ").toLowerCase()}:</strong> {a.reading}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-faint">
        Axes are qualitative and independent. They are never summed into a single &quot;quality&quot;, &quot;scientificness&quot;, &quot;reliability&quot; or &quot;truth&quot; score.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-soft">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm border border-rule bg-panel p-3 text-xs text-ink-muted">{children}</p>;
}

// ---------------------------------------------------------------------------

interface Chunk {
  t: string;
  mark: boolean;
  active: boolean;
}

function renderText(
  text: string,
  spans: { start: number; end: number }[],
  active: { start: number; end: number } | null,
): Chunk[] {
  if (!text) return [];
  const points = new Set<number>([0, text.length]);
  for (const s of spans) {
    points.add(Math.max(0, Math.min(text.length, s.start)));
    points.add(Math.max(0, Math.min(text.length, s.end)));
  }
  if (active) {
    points.add(Math.max(0, Math.min(text.length, active.start)));
    points.add(Math.max(0, Math.min(text.length, active.end)));
  }
  const sorted = [...points].sort((a, b) => a - b);
  const chunks: Chunk[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a === b) continue;
    const mid = (a + b) / 2;
    const mark = spans.some((s) => mid >= s.start && mid < s.end);
    const isActive = Boolean(active && mid >= active.start && mid < active.end);
    chunks.push({ t: text.slice(a, b), mark: mark || isActive, active: isActive });
  }
  return chunks;
}
