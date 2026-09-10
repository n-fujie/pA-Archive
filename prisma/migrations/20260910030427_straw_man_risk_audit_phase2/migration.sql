-- AlterTable
ALTER TABLE "audit_straw_man_risk_audits" ADD COLUMN     "comparativeSuperiorityUnverified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "critiqueSurvival" TEXT NOT NULL DEFAULT 'UNDETERMINED',
ADD COLUMN     "evidencePresence" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "targetIdentity" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "targetVersionResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'DOCUMENT_ONLY';
