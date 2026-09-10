import type { AuditStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getStorage, sha256 } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/log";
import { parseDocument, isParseable } from "@/lib/documents/parse";
import { planAudit } from "@/lib/ziran/orchestrator";
import { AUDIT_STAGES } from "@/lib/ziran/types";
import type { StageOutput, GroundRef } from "@/lib/ziran/types";
import { HeuristicAnalyzer } from "./stages";
import type { AnalyzerContext } from "./analyzer";
import { getSimulationProvider } from "@/lib/simulation";

export class AuditPipelineError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const MAX_TEXT_STORED = 400_000; // characters kept in extractedText

interface UploadInput {
  filename: string;
  contentType: string;
  bytes: Buffer;
  title?: string | null;
}

/**
 * Create an audit session from an uploaded document and run the phase-1
 * pipeline synchronously. Additive: touches only audit_* tables (+ an optional
 * read of records for DOI matching).
 */
export async function createAndRunAuditSession(
  uploaderId: string,
  file: UploadInput,
  ip?: string | null,
): Promise<{ sessionId: string }> {
  if (!env.auditEnabled) throw new AuditPipelineError("The research-audit layer is disabled.", 404);
  if (!isParseable(file.contentType, file.filename)) {
    throw new AuditPipelineError("Unsupported document type. Accepted: PDF, DOCX, Markdown, plain text.", 422);
  }
  if (file.bytes.length <= 0) throw new AuditPipelineError("Empty file.", 422);
  if (file.bytes.length > env.auditMaxDocBytes) {
    throw new AuditPipelineError(`Document exceeds the ${(env.auditMaxDocBytes / 1_048_576).toFixed(0)} MiB limit.`, 413);
  }

  const session = await prisma.auditSession.create({
    data: { uploaderId, status: "PARSING", title: file.title?.slice(0, 300) || null },
  });

  try {
    // --- parse ---------------------------------------------------------
    const parsed = await parseDocument(file.bytes, file.contentType, file.filename);
    if (!parsed.text.trim()) {
      throw new AuditPipelineError("No text could be extracted from the document.", 422);
    }

    // --- store the file ---------------------------------------------
    const storage = getStorage();
    const key = `audit/${session.id}/${crypto.randomUUID()}-${file.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100)}`;
    const put = await storage.put({ key, body: file.bytes, contentType: file.contentType || "application/octet-stream", filename: file.filename });

    await prisma.sourceDocument.create({
      data: {
        sessionId: session.id,
        originalName: file.filename,
        contentType: file.contentType || "application/octet-stream",
        byteSize: file.bytes.length,
        checksumSha256: sha256(file.bytes),
        storageProvider: put.provider,
        storageKey: put.key,
        extractedText: parsed.text.slice(0, MAX_TEXT_STORED),
        pageCount: parsed.meta.pageCount ?? null,
        wordCount: parsed.meta.wordCount,
        parserName: parsed.meta.parserName,
        parserVersion: parsed.meta.parserVersion,
      },
    });

    // --- persist segments (keep index → id) --------------------------
    const segmentIds: string[] = [];
    for (const seg of parsed.segments) {
      const row = await prisma.documentSegment.create({
        data: {
          sessionId: session.id,
          kind: seg.kind,
          label: seg.label,
          order: seg.order,
          charStart: seg.charStart,
          charEnd: seg.charEnd,
          text: seg.text.slice(0, 20_000),
          parentId: seg.parentIndex !== undefined ? segmentIds[seg.parentIndex] ?? null : null,
        },
      });
      segmentIds[seg.order] = row.id;
    }

    // --- DOI / archive-record match -------------------------------
    const doiMatch = parsed.text.match(/10\.\d{4,9}\/[^\s"'<>)]+/)?.[0]?.replace(/[.,;)\]]+$/, "");
    let linkedRecordSlug: string | null = null;
    let linkedDoi: string | null = null;
    let peerReviewStatus: string | null = null;
    if (doiMatch) {
      const idRow = await prisma.identifier.findFirst({
        where: { type: "DOI", value: { equals: doiMatch, mode: "insensitive" } },
        include: { record: true },
      });
      if (idRow) {
        linkedDoi = idRow.value;
        linkedRecordSlug = String(idRow.record.paidNumber).padStart(6, "0");
        peerReviewStatus = idRow.record.peerReviewStatus;
        await prisma.auditSession.update({ where: { id: session.id }, data: { recordId: idRow.recordId } });
      }
    }

    // --- orchestrate --------------------------------------------------
    await prisma.auditSession.update({ where: { id: session.id }, data: { status: "ORCHESTRATING" } });
    const plan = planAudit(parsed, { hasDoiOrRecordLink: Boolean(linkedRecordSlug) });
    const run = await prisma.ziranRun.create({
      data: {
        sessionId: session.id,
        methodologyVersion: plan.methodologyVersion,
        planNote: plan.planNote,
        activations: {
          create: plan.stages.map((s) => ({
            stage: s.stage,
            state: s.state,
            customState: s.customState ?? null,
            reason: s.reason,
            segmentScope: (s.segmentScope ?? undefined) as Prisma.InputJsonValue | undefined,
            order: s.order,
          })),
        },
      },
    });

    // --- run fired stages ------------------------------------------
    await prisma.auditSession.update({ where: { id: session.id }, data: { status: "ANALYZING" } });
    const analyzer = new HeuristicAnalyzer();
    const prior: Partial<Record<AuditStage, StageOutput>> = {};
    const firedStages = plan.stages.filter((s) => s.state === "FIRED").sort((a, b) => a.order - b.order);

    for (const planned of firedStages) {
      if (planned.stage === "REPORT") continue; // handled last
      const ctx: AnalyzerContext = {
        sessionId: session.id,
        doc: parsed,
        segmentIds,
        planned,
        prior,
        linkedRecordSlug,
        linkedDoi,
        peerReviewStatus,
      };
      let out: StageOutput;
      try {
        out = await analyzer.analyze(planned.stage, ctx);
      } catch (err) {
        logger.error("audit.stage_failed", err, { sessionId: session.id, stage: planned.stage });
        out = {
          findings: [{ kind: "NEEDS_INVESTIGATION", summary: `Stage ${planned.stage} could not complete.`, source: "HEURISTIC", detail: (err as Error).message }],
        };
      }
      prior[planned.stage] = out;

      if (out.notApplicable) {
        await prisma.ziranStageActivation.update({
          where: { runId_stage: { runId: run.id, stage: planned.stage } },
          data: { state: "NOT_APPLICABLE", reason: `${planned.reason} · after inspection: ${out.notApplicable.reason}` },
        });
        continue;
      }
      await persistStageOutput(session.id, planned.stage, out);
    }

    // --- report (stage 15) --------------------------------------
    await persistReport(session.id, plan, prior);

    await prisma.auditSession.update({
      where: { id: session.id },
      data: { status: "READY", completedAt: new Date() },
    });
    await writeAudit({
      action: "RECORD_CREATE",
      actorId: uploaderId,
      targetType: "audit_session",
      targetId: session.id,
      summary: `Research-audit session for "${file.filename}" completed (${firedStages.length} stage(s) fired).`,
      ip,
    });
    return { sessionId: session.id };
  } catch (err) {
    await prisma.auditSession
      .update({
        where: { id: session.id },
        data: { status: "FAILED", failureReason: err instanceof Error ? err.message : String(err) },
      })
      .catch(() => undefined);
    if (err instanceof AuditPipelineError) throw err;
    logger.error("audit.pipeline_failed", err, { sessionId: session.id });
    throw new AuditPipelineError("The audit pipeline failed. See the session for details.", 500);
  }
}

async function persistStageOutput(sessionId: string, stage: AuditStage, out: StageOutput): Promise<void> {
  const j = (v: unknown): Prisma.InputJsonValue => (v ?? []) as Prisma.InputJsonValue;

  if (out.findings?.length) {
    await prisma.auditFinding.createMany({
      data: out.findings.map((f) => ({
        sessionId,
        stage,
        kind: f.kind,
        summary: f.summary.slice(0, 500),
        detail: f.detail ?? "",
        source: f.source,
        inferencePath: f.inferencePath ?? "",
        groundRefs: j(f.groundRefs),
        uncertaintyText: f.uncertaintyText ?? "",
        undecidable: f.undecidable ?? false,
        needsVerification: f.needsVerification ?? false,
        severity: f.severity ?? null,
        aiOperationId: f.aiOperationId ?? null,
      })),
    });
  }

  if (out.categories?.length) {
    for (const c of out.categories as Record<string, unknown>[]) {
      await prisma.auditCategory.create({
        data: {
          sessionId,
          term: String(c.term),
          surfaceForms: (c.surfaceForms as string[]) ?? [],
          firstSegmentId: (c.firstSegmentId as string) ?? null,
          treatedAsGiven: (c.treatedAsGiven as boolean | null) ?? null,
          establishmentConditions: (c.establishmentConditions as string) ?? null,
          constrainsSubsequent: String(c.constrainsSubsequent ?? "UNKNOWN"),
        },
      });
    }
  }

  if (out.ignition?.length) {
    for (const ig of out.ignition) {
      const cat = await prisma.auditCategory.findFirst({ where: { sessionId, term: ig.term } });
      if (!cat) continue;
      await prisma.categoryIgnitionRecord.create({
        data: {
          categoryId: cat.id,
          changeForm: String(ig.record.changeForm ?? "IGNITION"),
          customForm: (ig.record.customForm as string) ?? null,
          segmentId: (ig.record.segmentId as string) ?? null,
          impliedConditions: String(ig.record.impliedConditions ?? ""),
          persistsUnderBoundaryChange: String(ig.record.persistsUnderBoundaryChange ?? "UNKNOWN"),
          persistsUnderScaleChange: String(ig.record.persistsUnderScaleChange ?? "UNKNOWN"),
          substitutionChangesInference: String(ig.record.substitutionChangesInference ?? "UNKNOWN"),
          analysisHoldsIfSuspended: String(ig.record.analysisHoldsIfSuspended ?? "UNKNOWN"),
          note: String(ig.record.note ?? ""),
        },
      });
    }
  }

  const simple: [keyof StageOutput, (rows: Record<string, unknown>[]) => Promise<unknown>][] = [
    ["transitions", (rows) => prisma.transitionClaim.createMany({ data: rows.map((r) => ({ sessionId, fromState: String(r.fromState).slice(0, 300), toState: String(r.toState).slice(0, 300), enablingConditions: String(r.enablingConditions ?? ""), disablingConditions: String(r.disablingConditions ?? ""), dependencyNotes: String(r.dependencyNotes ?? ""), conditionSensitivity: String(r.conditionSensitivity ?? ""), boundaryScaleVariance: String(r.boundaryScaleVariance ?? ""), groundRefs: j(r.groundRefs), source: (r.source as "HEURISTIC") ?? "HEURISTIC" })) })],
    ["dependencies", (rows) => prisma.dependencyEdge.createMany({ data: rows.map((r) => ({ sessionId, fromLabel: String(r.fromLabel), toLabel: String(r.toLabel), kind: String(r.kind ?? "OTHER"), note: String(r.note ?? ""), groundRefs: j(r.groundRefs), source: (r.source as "HEURISTIC") ?? "HEURISTIC" })) })],
    ["historyReinjections", (rows) => prisma.historyReinjection.createMany({ data: rows.map((r) => ({ sessionId, pastKind: String(r.pastKind), pastDescription: String(r.pastDescription).slice(0, 4000), reinjectedIntoKind: String(r.reinjectedIntoKind ?? "OTHER"), reinjectionDescription: String(r.reinjectionDescription).slice(0, 4000), groundRefs: j(r.groundRefs), source: (r.source as "HEURISTIC") ?? "HEURISTIC" })) })],
    ["addressNodes", (rows) => prisma.addressNode.createMany({ data: rows.map((r) => ({ sessionId, kind: String(r.kind), label: String(r.label).slice(0, 200), roleInGeneration: String(r.roleInGeneration ?? ""), influencesOn: j(r.influencesOn), groundRefs: j(r.groundRefs), source: (r.source as "DOCUMENT") ?? "DOCUMENT" })) })],
    ["claimEvidence", (rows) => prisma.claimEvidenceLink.createMany({ data: rows.map((r) => ({ sessionId, claimText: String(r.claimText).slice(0, 4000), claimSegmentId: (r.claimSegmentId as string) ?? null, directGroundRefs: j(r.directGroundRefs), citationGroundRefs: j(r.citationGroundRefs), dataGroundRefs: j(r.dataGroundRefs), modelDependencyText: String(r.modelDependencyText ?? ""), simulationDependencyText: String(r.simulationDependencyText ?? ""), inferenceCompletionText: String(r.inferenceCompletionText ?? ""), counterexampleText: String(r.counterexampleText ?? ""), alternativeExplanationText: String(r.alternativeExplanationText ?? ""), unverifiedPartsText: String(r.unverifiedPartsText ?? ""), source: (r.source as "HEURISTIC") ?? "HEURISTIC" })) })],
    ["simulationCandidates", (rows) => prisma.simulationCandidate.createMany({ data: rows.map((r) => ({ sessionId, description: String(r.description).slice(0, 4000), detected: j(r.detected), providerHandoff: j(r.providerHandoff), varyableInputs: j(r.varyableInputs), groundRefs: j(r.groundRefs), source: (r.source as "HEURISTIC") ?? "HEURISTIC" })) })],
    ["theoryMines", (rows) => prisma.theoryMineFinding.createMany({ data: rows.map((r) => ({ sessionId, claimText: String(r.claimText).slice(0, 4000), claimSegmentId: (r.claimSegmentId as string) ?? null, mineKind: String(r.mineKind), reason: String(r.reason).slice(0, 2000), severity: String(r.severity ?? "LOW"), groundRefs: j(r.groundRefs), source: (r.source as "HEURISTIC") ?? "HEURISTIC" })) })],
    ["regressions", (rows) => prisma.regressionFinding.createMany({ data: rows.map((r) => ({ sessionId, description: String(r.description).slice(0, 4000), regressedToWhat: String(r.regressedToWhat ?? ""), withinDocument: (r.withinDocument as boolean) ?? true, groundRefs: j(r.groundRefs), source: (r.source as "HEURISTIC") ?? "HEURISTIC" })) })],
    ["theoryFeedback", (rows) => prisma.theoryFeedback.createMany({ data: rows.map((r) => ({ sessionId, targetLayer: String(r.targetLayer), proposedChange: String(r.proposedChange), rationale: String(r.rationale).slice(0, 6000), groundRefs: j(r.groundRefs), source: (r.source as "HEURISTIC") ?? "HEURISTIC", status: String(r.status ?? "OPEN") })) })],
  ];
  for (const [key, fn] of simple) {
    const rows = out[key] as Record<string, unknown>[] | undefined;
    if (rows?.length) await fn(rows);
  }

  if (out.evaluationAxes?.length) {
    for (const a of out.evaluationAxes) {
      await prisma.evaluationAxisReading.upsert({
        where: { sessionId_axis: { sessionId, axis: a.axis } },
        create: { sessionId, axis: a.axis, fired: a.fired, reading: a.reading.slice(0, 4000) },
        update: { fired: a.fired, reading: a.reading.slice(0, 4000) },
      });
    }
  }
}

async function persistReport(
  sessionId: string,
  plan: ReturnType<typeof planAudit>,
  prior: Partial<Record<AuditStage, StageOutput>>,
): Promise<void> {
  const fired = new Set(plan.stages.filter((s) => s.state === "FIRED").map((s) => s.stage));
  const sections = AUDIT_STAGES.filter((s) => s.id !== "REPORT")
    .map((meta) => {
      const applicable = fired.has(meta.id) && !prior[meta.id]?.notApplicable;
      if (!applicable) return null;
      const out = prior[meta.id];
      const findingCount = out?.findings?.length ?? 0;
      const rowCount =
        (out?.categories?.length ?? 0) +
        (out?.transitions?.length ?? 0) +
        (out?.historyReinjections?.length ?? 0) +
        (out?.addressNodes?.length ?? 0) +
        (out?.claimEvidence?.length ?? 0) +
        (out?.simulationCandidates?.length ?? 0) +
        (out?.theoryMines?.length ?? 0) +
        (out?.regressions?.length ?? 0);
      return {
        key: meta.id,
        n: meta.n,
        title: meta.label,
        applicable: true,
        body: `${findingCount} finding(s), ${rowCount} structured item(s). ${meta.blurb}`,
      };
    })
    .filter(Boolean);

  // Never-omitted note: undecided + needs-investigation roll-up.
  const undecided: string[] = [];
  for (const out of Object.values(prior)) {
    for (const f of out?.findings ?? []) {
      if (f.undecidable) undecided.push(`[undecided] ${f.summary}`);
      if (f.needsVerification && f.severity === "HIGH") undecided.push(`[verify] ${f.summary}`);
    }
  }

  await prisma.auditReport.create({
    data: {
      sessionId,
      sections: [
        ...(sections as unknown[]),
        {
          key: "OPEN_ITEMS",
          n: 0,
          title: "Undecided / needs investigation",
          applicable: true,
          body: undecided.length ? undecided.slice(0, 40).join("\n") : "No items were left undecided by the stages that fired.",
        },
      ] as Prisma.InputJsonValue,
    },
  });
}

export { getSimulationProvider };
