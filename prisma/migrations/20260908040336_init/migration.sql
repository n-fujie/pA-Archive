-- CreateEnum
CREATE TYPE "Role" AS ENUM ('READER', 'SUBMITTER', 'REVIEWER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETRACTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VersionState" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('JOURNAL_ARTICLE', 'PREPRINT', 'BOOK', 'BOOK_CHAPTER', 'WORKING_PAPER', 'RESEARCH_NOTE', 'DATASET', 'SOFTWARE', 'PEER_REVIEW', 'REPORT', 'THESIS', 'PRESENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PeerReviewStatus" AS ENUM ('NOT_REVIEWED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'ACCEPTED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('PAID', 'DOI');

-- CreateEnum
CREATE TYPE "IdentifierStatus" AS ENUM ('LOCAL', 'RESERVED', 'PENDING', 'REGISTERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewAssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('NONE', 'ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('REVIEWS', 'IS_REVIEWED_BY', 'IS_NEW_VERSION_OF', 'IS_PREVIOUS_VERSION_OF', 'CITES', 'IS_SUPPLEMENT_TO', 'IS_SUPPLEMENTED_BY', 'CORRECTS', 'IS_CORRECTED_BY');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('CORRECTION', 'RETRACTION', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTER', 'USER_ROLE_CHANGE', 'RECORD_CREATE', 'METADATA_UPDATE', 'FILE_UPLOAD', 'FILE_REPLACE', 'FILE_DELETE', 'VERSION_CREATE', 'PUBLISH', 'UNPUBLISH', 'REVIEW_ASSIGNMENT', 'REVIEW_SUBMISSION', 'REVIEW_STATUS_CHANGE', 'IDENTIFIER_GENERATION', 'DOI_REGISTRATION', 'DOI_REGISTRATION_FAILED', 'CORRECTION', 'RETRACTION', 'WITHDRAWAL', 'DOWNLOAD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SUBMITTER',
    "orcid" TEXT,
    "affiliation" TEXT,
    "organizationId" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "rorId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'institution',
    "homepage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records" (
    "id" TEXT NOT NULL,
    "paidNumber" INTEGER NOT NULL,
    "paidYear" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT NOT NULL,
    "publicationType" "PublicationType" NOT NULL DEFAULT 'OTHER',
    "peerReviewStatus" "PeerReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "submitterId" TEXT NOT NULL,
    "organizationId" TEXT,
    "currentVersionId" TEXT,
    "firstPublishedAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_versions" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "state" "VersionState" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "abstract" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "publicationType" "PublicationType" NOT NULL DEFAULT 'OTHER',
    "licenseId" TEXT,
    "publicationDate" TIMESTAMP(3),
    "references" TEXT NOT NULL DEFAULT '',
    "relatedIdentifiers" JSONB NOT NULL DEFAULT '[]',
    "funding" JSONB NOT NULL DEFAULT '[]',
    "conflictOfInterest" TEXT NOT NULL DEFAULT '',
    "ethicsStatement" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL,
    "familyName" TEXT,
    "givenName" TEXT,
    "fullName" TEXT NOT NULL,
    "orcid" TEXT,
    "affiliation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_authors" (
    "id" TEXT NOT NULL,
    "recordVersionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isCorresponding" BOOLEAN NOT NULL DEFAULT false,
    "affiliationOverride" TEXT,

    CONSTRAINT "record_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "recordVersionId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identifiers" (
    "id" TEXT NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "status" "IdentifierStatus" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "recordId" TEXT NOT NULL,
    "recordVersionId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paid_allocations" (
    "number" SERIAL NOT NULL,
    "recordId" TEXT,
    "year" INTEGER NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_allocations_pkey" PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "targetRecordId" TEXT,
    "targetIdentifier" TEXT,
    "relationType" "RelationType" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_assignments" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "ReviewAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peer_reviews" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "recommendation" "ReviewRecommendation" NOT NULL DEFAULT 'NONE',
    "body" TEXT NOT NULL,
    "confidential" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "reviewRecordId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_notices" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" "NoticeType" NOT NULL,
    "reason" TEXT NOT NULL,
    "detailsUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_events" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_rorId_key" ON "organizations"("rorId");

-- CreateIndex
CREATE UNIQUE INDEX "records_paidNumber_key" ON "records"("paidNumber");

-- CreateIndex
CREATE UNIQUE INDEX "records_currentVersionId_key" ON "records"("currentVersionId");

-- CreateIndex
CREATE INDEX "records_status_idx" ON "records"("status");

-- CreateIndex
CREATE INDEX "records_category_idx" ON "records"("category");

-- CreateIndex
CREATE INDEX "records_publicationType_idx" ON "records"("publicationType");

-- CreateIndex
CREATE INDEX "records_paidYear_idx" ON "records"("paidYear");

-- CreateIndex
CREATE INDEX "record_versions_state_idx" ON "record_versions"("state");

-- CreateIndex
CREATE INDEX "record_versions_title_idx" ON "record_versions"("title");

-- CreateIndex
CREATE UNIQUE INDEX "record_versions_recordId_versionNumber_key" ON "record_versions"("recordId", "versionNumber");

-- CreateIndex
CREATE INDEX "authors_orcid_idx" ON "authors"("orcid");

-- CreateIndex
CREATE INDEX "authors_fullName_idx" ON "authors"("fullName");

-- CreateIndex
CREATE INDEX "record_authors_authorId_idx" ON "record_authors"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "record_authors_recordVersionId_position_key" ON "record_authors"("recordVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "files_supersededById_key" ON "files"("supersededById");

-- CreateIndex
CREATE INDEX "files_recordVersionId_idx" ON "files"("recordVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "identifiers_value_key" ON "identifiers"("value");

-- CreateIndex
CREATE INDEX "identifiers_type_idx" ON "identifiers"("type");

-- CreateIndex
CREATE INDEX "identifiers_status_idx" ON "identifiers"("status");

-- CreateIndex
CREATE INDEX "identifiers_recordId_idx" ON "identifiers"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "paid_allocations_recordId_key" ON "paid_allocations"("recordId");

-- CreateIndex
CREATE INDEX "relationships_sourceRecordId_idx" ON "relationships"("sourceRecordId");

-- CreateIndex
CREATE INDEX "relationships_targetRecordId_idx" ON "relationships"("targetRecordId");

-- CreateIndex
CREATE INDEX "review_assignments_reviewerId_idx" ON "review_assignments"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "review_assignments_recordId_reviewerId_key" ON "review_assignments"("recordId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "peer_reviews_assignmentId_key" ON "peer_reviews"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "peer_reviews_reviewRecordId_key" ON "peer_reviews"("reviewRecordId");

-- CreateIndex
CREATE INDEX "peer_reviews_recordId_idx" ON "peer_reviews"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_code_key" ON "licenses"("code");

-- CreateIndex
CREATE INDEX "record_notices_recordId_idx" ON "record_notices"("recordId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "download_events_fileId_idx" ON "download_events"("fileId");

-- CreateIndex
CREATE INDEX "download_events_recordId_idx" ON "download_events"("recordId");

-- CreateIndex
CREATE INDEX "download_events_createdAt_idx" ON "download_events"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "record_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_authors" ADD CONSTRAINT "record_authors_recordVersionId_fkey" FOREIGN KEY ("recordVersionId") REFERENCES "record_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_authors" ADD CONSTRAINT "record_authors_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_recordVersionId_fkey" FOREIGN KEY ("recordVersionId") REFERENCES "record_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identifiers" ADD CONSTRAINT "identifiers_recordVersionId_fkey" FOREIGN KEY ("recordVersionId") REFERENCES "record_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_targetRecordId_fkey" FOREIGN KEY ("targetRecordId") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_reviews" ADD CONSTRAINT "peer_reviews_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_reviews" ADD CONSTRAINT "peer_reviews_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "review_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_reviews" ADD CONSTRAINT "peer_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_notices" ADD CONSTRAINT "record_notices_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
