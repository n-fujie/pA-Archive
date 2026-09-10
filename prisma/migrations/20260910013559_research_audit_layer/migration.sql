-- CreateEnum
CREATE TYPE "AuditSessionStatus" AS ENUM ('RECEIVED', 'PARSING', 'ORCHESTRATING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditFindingSource" AS ENUM ('DOCUMENT', 'HEURISTIC', 'AI_INFERENCE', 'MIXED');

-- CreateEnum
CREATE TYPE "AuditStage" AS ENUM ('STRUCTURE', 'CATEGORIES', 'CATEGORY_IGNITION', 'WEAK_OPERATIONAL', 'TRANSITION', 'HISTORY_REINJECTION', 'BOUNDARY_SCALE', 'ADDRESS_DOMAIN', 'CLAIM_EVIDENCE', 'DOI_REVIEW', 'SIMULATION', 'COUNTERFACTUAL', 'THEORY_MINE', 'REGRESSION', 'REPORT');

-- CreateEnum
CREATE TYPE "StageActivationState" AS ENUM ('FIRED', 'SUSPENDED', 'TERMINATED', 'RECLASSIFIED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "DocumentSegmentKind" AS ENUM ('TITLE', 'ABSTRACT', 'SECTION', 'SUBSECTION', 'PARAGRAPH', 'CITATION', 'REFERENCE', 'FIGURE', 'TABLE', 'EQUATION', 'DATA_STATEMENT', 'METHOD', 'RESULT', 'CONCLUSION', 'OTHER');

-- CreateTable
CREATE TABLE "audit_sessions" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "status" "AuditSessionStatus" NOT NULL DEFAULT 'RECEIVED',
    "recordId" TEXT,
    "title" TEXT,
    "methodologyVersion" TEXT NOT NULL DEFAULT 'audit-layer-2026-09-phase1',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "audit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_source_documents" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "pageCount" INTEGER,
    "wordCount" INTEGER,
    "parserName" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_document_segments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "DocumentSegmentKind" NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "audit_document_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_ziran_runs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL DEFAULT 'ziran-orchestration-2026-09-phase1',
    "vocabularyNote" TEXT NOT NULL DEFAULT 'difference/state/transition/dependency/relation/time/scale/boundary/history/access/configuration are the current revisable analytical vocabulary, adopted only where discriminating — not a final ontology.',
    "planNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_ziran_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_ziran_stage_activations" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" "AuditStage" NOT NULL,
    "state" "StageActivationState" NOT NULL,
    "customState" TEXT,
    "reason" TEXT NOT NULL,
    "segmentScope" JSONB,
    "order" INTEGER NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_ziran_stage_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_categories" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "surfaceForms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstSegmentId" TEXT,
    "treatedAsGiven" BOOLEAN,
    "establishmentConditions" TEXT,
    "constrainsSubsequent" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_category_ignition_records" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "changeForm" TEXT NOT NULL,
    "customForm" TEXT,
    "segmentId" TEXT,
    "impliedConditions" TEXT NOT NULL DEFAULT '',
    "persistsUnderBoundaryChange" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "persistsUnderScaleChange" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "substitutionChangesInference" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "analysisHoldsIfSuspended" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "audit_category_ignition_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_findings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stage" "AuditStage" NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "source" "AuditFindingSource" NOT NULL,
    "inferencePath" TEXT NOT NULL DEFAULT '',
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "uncertaintyText" TEXT NOT NULL DEFAULT '',
    "undecidable" BOOLEAN NOT NULL DEFAULT false,
    "needsVerification" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT,
    "aiOperationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_transition_claims" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "enablingConditions" TEXT NOT NULL DEFAULT '',
    "disablingConditions" TEXT NOT NULL DEFAULT '',
    "dependencyNotes" TEXT NOT NULL DEFAULT '',
    "conditionSensitivity" TEXT NOT NULL DEFAULT '',
    "boundaryScaleVariance" TEXT NOT NULL DEFAULT '',
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',

    CONSTRAINT "audit_transition_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_dependency_edges" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromLabel" TEXT NOT NULL,
    "toLabel" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "note" TEXT NOT NULL DEFAULT '',
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',

    CONSTRAINT "audit_dependency_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_history_reinjections" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pastKind" TEXT NOT NULL,
    "pastDescription" TEXT NOT NULL,
    "reinjectedIntoKind" TEXT NOT NULL,
    "reinjectionDescription" TEXT NOT NULL,
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',

    CONSTRAINT "audit_history_reinjections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_address_nodes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "roleInGeneration" TEXT NOT NULL DEFAULT '',
    "influencesOn" JSONB NOT NULL DEFAULT '[]',
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'DOCUMENT',

    CONSTRAINT "audit_address_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_claim_evidence_links" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "claimSegmentId" TEXT,
    "directGroundRefs" JSONB NOT NULL DEFAULT '[]',
    "citationGroundRefs" JSONB NOT NULL DEFAULT '[]',
    "dataGroundRefs" JSONB NOT NULL DEFAULT '[]',
    "modelDependencyText" TEXT NOT NULL DEFAULT '',
    "simulationDependencyText" TEXT NOT NULL DEFAULT '',
    "inferenceCompletionText" TEXT NOT NULL DEFAULT '',
    "counterexampleText" TEXT NOT NULL DEFAULT '',
    "alternativeExplanationText" TEXT NOT NULL DEFAULT '',
    "unverifiedPartsText" TEXT NOT NULL DEFAULT '',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',

    CONSTRAINT "audit_claim_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_simulation_candidates" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detected" JSONB NOT NULL DEFAULT '{}',
    "providerHandoff" JSONB NOT NULL DEFAULT '{}',
    "varyableInputs" JSONB NOT NULL DEFAULT '[]',
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',

    CONSTRAINT "audit_simulation_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_theory_mine_findings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "claimSegmentId" TEXT,
    "mineKind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',

    CONSTRAINT "audit_theory_mine_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_regression_findings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "regressedToWhat" TEXT NOT NULL DEFAULT '',
    "withinDocument" BOOLEAN NOT NULL DEFAULT true,
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',

    CONSTRAINT "audit_regression_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_theory_feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "targetLayer" TEXT NOT NULL,
    "proposedChange" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_theory_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_evaluation_axis_readings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "axis" TEXT NOT NULL,
    "fired" BOOLEAN NOT NULL DEFAULT true,
    "reading" TEXT NOT NULL,

    CONSTRAINT "audit_evaluation_axis_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_ai_operations" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT,
    "modelVersion" TEXT,
    "inputSummary" TEXT NOT NULL,
    "availableInfo" TEXT NOT NULL DEFAULT '',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outputSummary" TEXT NOT NULL,
    "downstreamInfluence" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "audit_ai_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_reports" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sections" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "audit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_sessions_uploaderId_idx" ON "audit_sessions"("uploaderId");

-- CreateIndex
CREATE INDEX "audit_sessions_status_idx" ON "audit_sessions"("status");

-- CreateIndex
CREATE INDEX "audit_sessions_recordId_idx" ON "audit_sessions"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_source_documents_sessionId_key" ON "audit_source_documents"("sessionId");

-- CreateIndex
CREATE INDEX "audit_document_segments_sessionId_order_idx" ON "audit_document_segments"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "audit_ziran_runs_sessionId_key" ON "audit_ziran_runs"("sessionId");

-- CreateIndex
CREATE INDEX "audit_ziran_stage_activations_runId_order_idx" ON "audit_ziran_stage_activations"("runId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "audit_ziran_stage_activations_runId_stage_key" ON "audit_ziran_stage_activations"("runId", "stage");

-- CreateIndex
CREATE INDEX "audit_categories_sessionId_idx" ON "audit_categories"("sessionId");

-- CreateIndex
CREATE INDEX "audit_category_ignition_records_categoryId_idx" ON "audit_category_ignition_records"("categoryId");

-- CreateIndex
CREATE INDEX "audit_findings_sessionId_stage_idx" ON "audit_findings"("sessionId", "stage");

-- CreateIndex
CREATE INDEX "audit_findings_sessionId_kind_idx" ON "audit_findings"("sessionId", "kind");

-- CreateIndex
CREATE INDEX "audit_transition_claims_sessionId_idx" ON "audit_transition_claims"("sessionId");

-- CreateIndex
CREATE INDEX "audit_dependency_edges_sessionId_idx" ON "audit_dependency_edges"("sessionId");

-- CreateIndex
CREATE INDEX "audit_history_reinjections_sessionId_idx" ON "audit_history_reinjections"("sessionId");

-- CreateIndex
CREATE INDEX "audit_address_nodes_sessionId_idx" ON "audit_address_nodes"("sessionId");

-- CreateIndex
CREATE INDEX "audit_claim_evidence_links_sessionId_idx" ON "audit_claim_evidence_links"("sessionId");

-- CreateIndex
CREATE INDEX "audit_simulation_candidates_sessionId_idx" ON "audit_simulation_candidates"("sessionId");

-- CreateIndex
CREATE INDEX "audit_theory_mine_findings_sessionId_idx" ON "audit_theory_mine_findings"("sessionId");

-- CreateIndex
CREATE INDEX "audit_regression_findings_sessionId_idx" ON "audit_regression_findings"("sessionId");

-- CreateIndex
CREATE INDEX "audit_theory_feedback_sessionId_idx" ON "audit_theory_feedback"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_evaluation_axis_readings_sessionId_axis_key" ON "audit_evaluation_axis_readings"("sessionId", "axis");

-- CreateIndex
CREATE INDEX "audit_ai_operations_sessionId_idx" ON "audit_ai_operations"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_reports_sessionId_key" ON "audit_reports"("sessionId");

-- AddForeignKey
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_source_documents" ADD CONSTRAINT "audit_source_documents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_document_segments" ADD CONSTRAINT "audit_document_segments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_document_segments" ADD CONSTRAINT "audit_document_segments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "audit_document_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_ziran_runs" ADD CONSTRAINT "audit_ziran_runs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_ziran_stage_activations" ADD CONSTRAINT "audit_ziran_stage_activations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "audit_ziran_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_categories" ADD CONSTRAINT "audit_categories_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_category_ignition_records" ADD CONSTRAINT "audit_category_ignition_records_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "audit_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_aiOperationId_fkey" FOREIGN KEY ("aiOperationId") REFERENCES "audit_ai_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_transition_claims" ADD CONSTRAINT "audit_transition_claims_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_dependency_edges" ADD CONSTRAINT "audit_dependency_edges_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_history_reinjections" ADD CONSTRAINT "audit_history_reinjections_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_address_nodes" ADD CONSTRAINT "audit_address_nodes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_claim_evidence_links" ADD CONSTRAINT "audit_claim_evidence_links_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_simulation_candidates" ADD CONSTRAINT "audit_simulation_candidates_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_theory_mine_findings" ADD CONSTRAINT "audit_theory_mine_findings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_regression_findings" ADD CONSTRAINT "audit_regression_findings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_theory_feedback" ADD CONSTRAINT "audit_theory_feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_evaluation_axis_readings" ADD CONSTRAINT "audit_evaluation_axis_readings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_ai_operations" ADD CONSTRAINT "audit_ai_operations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
