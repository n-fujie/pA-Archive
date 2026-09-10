-- AlterEnum
ALTER TYPE "AuditStage" ADD VALUE 'STRAW_MAN_RISK';

-- CreateTable
CREATE TABLE "audit_straw_man_risk_audits" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "criticismSummary" TEXT NOT NULL,
    "primaryLiterature" TEXT NOT NULL DEFAULT 'UNDETERMINED',
    "latestPositionAlignment" TEXT NOT NULL DEFAULT 'UNDETERMINED',
    "alreadyProcessedPoints" TEXT NOT NULL DEFAULT 'UNDETERMINED',
    "strongVersionResponse" TEXT NOT NULL DEFAULT 'UNDETERMINED',
    "centralPropositionRepr" TEXT NOT NULL DEFAULT 'UNDETERMINED',
    "conceptLevelAccuracy" TEXT NOT NULL DEFAULT 'UNDETERMINED',
    "riskTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mainStrawManRisk" TEXT NOT NULL DEFAULT '',
    "grounds" TEXT NOT NULL DEFAULT '',
    "strongerReconstruction" TEXT NOT NULL DEFAULT '',
    "reviseWhileKeepingCritique" TEXT NOT NULL DEFAULT '',
    "fiveStage" JSONB NOT NULL DEFAULT '{}',
    "understandingInsufficientConcern" BOOLEAN NOT NULL DEFAULT false,
    "recursiveSelfApplicationNote" TEXT NOT NULL DEFAULT '',
    "groundRefs" JSONB NOT NULL DEFAULT '[]',
    "source" "AuditFindingSource" NOT NULL DEFAULT 'HEURISTIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_straw_man_risk_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_straw_man_risk_audits_sessionId_idx" ON "audit_straw_man_risk_audits"("sessionId");

-- AddForeignKey
ALTER TABLE "audit_straw_man_risk_audits" ADD CONSTRAINT "audit_straw_man_risk_audits_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "audit_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
