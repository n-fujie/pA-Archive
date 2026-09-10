import { prisma } from "@/lib/db";
import { AUDIT_STAGES, STAGE_BY_ID } from "@/lib/ziran/types";
import type { AuditStage } from "@prisma/client";

export async function listAuditSessions(userId: string, isStaff: boolean) {
  const rows = await prisma.auditSession.findMany({
    where: isStaff ? {} : { uploaderId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      document: { select: { originalName: true, wordCount: true, pageCount: true } },
      uploader: { select: { email: true, name: true } },
      _count: { select: { findings: true } },
      ziranRun: { include: { activations: { select: { stage: true, state: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? r.document?.originalName ?? "(untitled)",
    status: r.status,
    recordSlug: r.recordId ? undefined : undefined,
    findingCount: r._count.findings,
    firedStages: r.ziranRun?.activations.filter((a) => a.state === "FIRED").length ?? 0,
    words: r.document?.wordCount ?? null,
    createdAt: r.createdAt.toISOString(),
    uploader: r.uploader.name ?? r.uploader.email,
  }));
}

export async function loadAuditSession(id: string) {
  const s = await prisma.auditSession.findUnique({
    where: { id },
    include: {
      document: true,
      uploader: { select: { id: true, email: true, name: true } },
      record: { select: { paidNumber: true, peerReviewStatus: true } },
      segments: { orderBy: { order: "asc" } },
      ziranRun: { include: { activations: { orderBy: { order: "asc" } } } },
      categories: { include: { ignition: true }, orderBy: { term: "asc" } },
      findings: { orderBy: [{ stage: "asc" }, { createdAt: "asc" }] },
      transitions: true,
      dependencies: true,
      historyReinjections: true,
      addressNodes: true,
      claimEvidence: true,
      simulationCandidates: true,
      theoryMines: true,
      regressions: true,
      strawManRiskAudits: true,
      theoryFeedback: true,
      evaluationAxes: { orderBy: { axis: "asc" } },
      aiOperations: { orderBy: { executedAt: "asc" } },
      report: true,
    },
  });
  if (!s) return null;

  const slug = s.record ? String(s.record.paidNumber).padStart(6, "0") : null;
  const findingsByStage = new Map<AuditStage, typeof s.findings>();
  for (const f of s.findings) {
    const arr = findingsByStage.get(f.stage) ?? [];
    arr.push(f);
    findingsByStage.set(f.stage, arr);
  }

  return {
    id: s.id,
    title: s.title ?? s.document?.originalName ?? "(untitled)",
    status: s.status,
    failureReason: s.failureReason,
    methodologyVersion: s.methodologyVersion,
    createdAt: s.createdAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    uploader: { id: s.uploader.id, name: s.uploader.name ?? s.uploader.email },
    recordSlug: slug,
    peerReviewStatus: s.record?.peerReviewStatus ?? null,
    document: s.document
      ? {
          originalName: s.document.originalName,
          contentType: s.document.contentType,
          byteSize: s.document.byteSize,
          checksumSha256: s.document.checksumSha256,
          pageCount: s.document.pageCount,
          wordCount: s.document.wordCount,
          parser: `${s.document.parserName} v${s.document.parserVersion}`,
          text: s.document.extractedText,
        }
      : null,
    segments: s.segments.map((seg) => ({
      id: seg.id,
      kind: seg.kind,
      label: seg.label,
      order: seg.order,
      charStart: seg.charStart,
      charEnd: seg.charEnd,
    })),
    ziran: s.ziranRun
      ? {
          methodologyVersion: s.ziranRun.methodologyVersion,
          vocabularyNote: s.ziranRun.vocabularyNote,
          planNote: s.ziranRun.planNote,
          activations: s.ziranRun.activations.map((a) => ({
            stage: a.stage,
            stageLabel: STAGE_BY_ID[a.stage].label,
            stageNumber: STAGE_BY_ID[a.stage].n,
            state: a.state,
            customState: a.customState,
            reason: a.reason,
            order: a.order,
          })),
        }
      : null,
    stages: AUDIT_STAGES.map((meta) => ({
      ...meta,
      activation: s.ziranRun?.activations.find((a) => a.stage === meta.id) ?? null,
      findings: (findingsByStage.get(meta.id) ?? []).map(mapFinding),
    })),
    categories: s.categories.map((c) => ({
      id: c.id,
      term: c.term,
      surfaceForms: c.surfaceForms,
      treatedAsGiven: c.treatedAsGiven,
      establishmentConditions: c.establishmentConditions,
      constrainsSubsequent: c.constrainsSubsequent,
      ignition: c.ignition.map((ig) => ({
        changeForm: ig.customForm ?? ig.changeForm,
        impliedConditions: ig.impliedConditions,
        persistsUnderBoundaryChange: ig.persistsUnderBoundaryChange,
        persistsUnderScaleChange: ig.persistsUnderScaleChange,
        substitutionChangesInference: ig.substitutionChangesInference,
        analysisHoldsIfSuspended: ig.analysisHoldsIfSuspended,
        note: ig.note,
      })),
    })),
    transitions: s.transitions.map((t) => ({ ...t, groundRefs: t.groundRefs })),
    dependencies: s.dependencies,
    historyReinjections: s.historyReinjections,
    addressNodes: s.addressNodes,
    claimEvidence: s.claimEvidence,
    simulationCandidates: s.simulationCandidates,
    theoryMines: s.theoryMines,
    regressions: s.regressions,
    strawManRiskAudits: s.strawManRiskAudits.map((a) => ({
      id: a.id,
      targetKind: a.targetKind,
      targetLabel: a.targetLabel,
      criticismSummary: a.criticismSummary,
      dimensions: {
        primaryLiterature: a.primaryLiterature,
        latestPositionAlignment: a.latestPositionAlignment,
        alreadyProcessedPoints: a.alreadyProcessedPoints,
        strongVersionResponse: a.strongVersionResponse,
        centralPropositionRepr: a.centralPropositionRepr,
        conceptLevelAccuracy: a.conceptLevelAccuracy,
      },
      riskTypes: a.riskTypes,
      mainStrawManRisk: a.mainStrawManRisk,
      grounds: a.grounds,
      strongerReconstruction: a.strongerReconstruction,
      reviseWhileKeepingCritique: a.reviseWhileKeepingCritique,
      fiveStage: a.fiveStage as Record<string, unknown>,
      understandingInsufficientConcern: a.understandingInsufficientConcern,
      recursiveSelfApplicationNote: a.recursiveSelfApplicationNote,
      groundRefs: (a.groundRefs as { segmentId?: string; charStart: number; charEnd: number; quote: string }[]) ?? [],
      source: a.source,
    })),
    theoryFeedback: s.theoryFeedback,
    evaluationAxes: s.evaluationAxes.map((a) => ({ axis: a.axis, fired: a.fired, reading: a.reading })),
    aiOperations: s.aiOperations,
    report: s.report ? (s.report.sections as unknown[]) : [],
    allFindings: s.findings.map(mapFinding),
  };
}

function mapFinding(f: {
  id: string;
  stage: AuditStage;
  kind: string;
  summary: string;
  detail: string;
  source: string;
  inferencePath: string;
  groundRefs: unknown;
  uncertaintyText: string;
  undecidable: boolean;
  needsVerification: boolean;
  severity: string | null;
}) {
  return {
    id: f.id,
    stage: f.stage,
    stageLabel: STAGE_BY_ID[f.stage].label,
    kind: f.kind,
    summary: f.summary,
    detail: f.detail,
    source: f.source,
    inferencePath: f.inferencePath,
    groundRefs: (f.groundRefs as { segmentId?: string; charStart: number; charEnd: number; quote: string }[]) ?? [],
    uncertaintyText: f.uncertaintyText,
    undecidable: f.undecidable,
    needsVerification: f.needsVerification,
    severity: f.severity,
  };
}

export type AuditSessionView = NonNullable<Awaited<ReturnType<typeof loadAuditSession>>>;
