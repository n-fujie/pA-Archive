import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { RecordServiceError } from "@/lib/records/service";
import {
  allocatePaidNumber,
  formatPaid,
  recordSlug,
} from "@/lib/identifiers/paid";
import {
  peerReviewStatusSchema,
  reviewSubmissionSchema,
} from "@/lib/validation/schemas";

export async function assignReviewer(
  recordId: string,
  reviewerId: string,
  dueAt: string | null,
  editorId: string,
  ip?: string | null,
): Promise<void> {
  const [record, reviewer] = await Promise.all([
    prisma.record.findUnique({ where: { id: recordId } }),
    prisma.user.findUnique({ where: { id: reviewerId } }),
  ]);
  if (!record) throw new RecordServiceError("Record not found", 404);
  if (!reviewer) throw new RecordServiceError("Reviewer not found", 404);
  if (!["REVIEWER", "EDITOR", "ADMIN"].includes(reviewer.role)) {
    throw new RecordServiceError("That user is not a reviewer", 422);
  }

  await prisma.$transaction(async (tx) => {
    await tx.reviewAssignment.upsert({
      where: { recordId_reviewerId: { recordId, reviewerId } },
      create: {
        recordId,
        reviewerId,
        assignedById: editorId,
        dueAt: dueAt ? new Date(dueAt) : null,
        status: "ASSIGNED",
      },
      update: { status: "ASSIGNED", assignedById: editorId, dueAt: dueAt ? new Date(dueAt) : null },
    });
    if (record.peerReviewStatus === "NOT_REVIEWED") {
      await tx.record.update({ where: { id: recordId }, data: { peerReviewStatus: "UNDER_REVIEW" } });
    }
    await writeAudit(
      {
        action: "REVIEW_ASSIGNMENT",
        actorId: editorId,
        targetType: "record",
        targetId: recordId,
        summary: `Assigned reviewer ${reviewer.email} to ${formatPaid(record.paidYear, record.paidNumber)}`,
        ip,
      },
      tx,
    );
  });
}

export async function submitReview(
  assignmentId: string,
  raw: unknown,
  reviewerId: string,
  ip?: string | null,
): Promise<void> {
  const parsed = reviewSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RecordServiceError("Invalid review", 422, parsed.error.flatten());
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    const assignment = await tx.reviewAssignment.findUnique({
      where: { id: assignmentId },
      include: { record: true },
    });
    if (!assignment) throw new RecordServiceError("Assignment not found", 404);
    if (assignment.reviewerId !== reviewerId) {
      throw new RecordServiceError("This assignment is not yours", 403);
    }

    await tx.peerReview.upsert({
      where: { assignmentId },
      create: {
        recordId: assignment.recordId,
        assignmentId,
        reviewerId,
        recommendation: data.recommendation,
        body: data.body,
        confidential: data.confidential ?? "",
        isPublic: Boolean(data.isPublic),
      },
      update: {
        recommendation: data.recommendation,
        body: data.body,
        confidential: data.confidential ?? "",
        isPublic: Boolean(data.isPublic),
        submittedAt: new Date(),
      },
    });
    await tx.reviewAssignment.update({ where: { id: assignmentId }, data: { status: "COMPLETED" } });

    await writeAudit(
      {
        action: "REVIEW_SUBMISSION",
        actorId: reviewerId,
        targetType: "record",
        targetId: assignment.recordId,
        summary: `Review submitted for ${formatPaid(assignment.record.paidYear, assignment.record.paidNumber)} (${data.recommendation})`,
        ip,
      },
      tx,
    );
  });
}

export async function setPeerReviewStatus(
  recordId: string,
  status: string,
  editorId: string,
  ip?: string | null,
): Promise<void> {
  const parsed = peerReviewStatusSchema.safeParse(status);
  if (!parsed.success) throw new RecordServiceError("Invalid status", 422);

  const record = await prisma.record.findUnique({ where: { id: recordId } });
  if (!record) throw new RecordServiceError("Record not found", 404);

  await prisma.$transaction(async (tx) => {
    await tx.record.update({ where: { id: recordId }, data: { peerReviewStatus: parsed.data } });
    await writeAudit(
      {
        action: "REVIEW_STATUS_CHANGE",
        actorId: editorId,
        targetType: "record",
        targetId: recordId,
        summary: `Peer review status of ${formatPaid(record.paidYear, record.paidNumber)} -> ${parsed.data}`,
        ip,
      },
      tx,
    );
  });
}

/**
 * Promote a submitted review to an independent, citable record with its own
 * P/A Identifier, linked to the reviewed work with a `reviews` relationship.
 */
export async function publishReviewAsRecord(
  reviewId: string,
  editorId: string,
  ip?: string | null,
): Promise<{ slug: string }> {
  return prisma.$transaction(async (tx) => {
    const review = await tx.peerReview.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: true,
        record: { include: { currentVersion: { select: { title: true } } } },
      },
    });
    if (!review) throw new RecordServiceError("Review not found", 404);
    if (review.reviewRecordId) throw new RecordServiceError("This review is already a record", 409);

    const year = new Date().getUTCFullYear();
    const number = await allocatePaidNumber(tx, "pending", year);
    const now = new Date();

    const reviewRecord = await tx.record.create({
      data: {
        paidNumber: number,
        paidYear: year,
        status: "PUBLISHED",
        category: review.record.category,
        publicationType: "PEER_REVIEW",
        peerReviewStatus: "NOT_REVIEWED",
        submitterId: editorId,
        firstPublishedAt: now,
        lastPublishedAt: now,
      },
    });
    await tx.paidAllocation.update({ where: { number }, data: { recordId: reviewRecord.id } });

    const version = await tx.recordVersion.create({
      data: {
        recordId: reviewRecord.id,
        versionNumber: 1,
        versionLabel: "v1",
        state: "PUBLISHED",
        publishedAt: now,
        publicationDate: now,
        title: `Peer review of “${review.record.currentVersion?.title ?? formatPaid(review.record.paidYear, review.record.paidNumber)}”`,
        abstract: review.body.slice(0, 2000),
        keywords: ["peer review"],
        language: "en",
        publicationType: "PEER_REVIEW",
        references: "",
        conflictOfInterest: "",
        ethicsStatement: "",
      },
    });
    await tx.record.update({ where: { id: reviewRecord.id }, data: { currentVersionId: version.id } });

    // Author = reviewer (named review).
    const author = await tx.author.create({
      data: {
        fullName: review.reviewer.name ?? review.reviewer.email,
        orcid: review.reviewer.orcid,
        affiliation: review.reviewer.affiliation,
      },
    });
    await tx.recordAuthor.create({
      data: { recordVersionId: version.id, authorId: author.id, position: 0 },
    });

    await tx.identifier.create({
      data: {
        type: "PAID",
        value: formatPaid(year, number),
        status: "LOCAL",
        provider: "local",
        recordId: reviewRecord.id,
        recordVersionId: version.id,
        isPrimary: true,
        registeredAt: now,
      },
    });

    // Link: review record REVIEWS the article; article IS_REVIEWED_BY the review.
    await tx.relationship.createMany({
      data: [
        {
          sourceRecordId: reviewRecord.id,
          targetRecordId: review.recordId,
          relationType: "REVIEWS",
          createdById: editorId,
        },
        {
          sourceRecordId: review.recordId,
          targetRecordId: reviewRecord.id,
          relationType: "IS_REVIEWED_BY",
          createdById: editorId,
        },
      ],
    });

    await tx.peerReview.update({
      where: { id: reviewId },
      data: { reviewRecordId: reviewRecord.id, isPublic: true },
    });

    await writeAudit(
      {
        action: "PUBLISH",
        actorId: editorId,
        targetType: "record",
        targetId: reviewRecord.id,
        summary: `Peer review published as record ${formatPaid(year, number)}`,
        ip,
      },
      tx,
    );
    await writeAudit(
      {
        action: "IDENTIFIER_GENERATION",
        actorId: editorId,
        targetType: "identifier",
        targetId: reviewRecord.id,
        summary: `P/A Identifier allocated for review record: ${formatPaid(year, number)}`,
        ip,
      },
      tx,
    );

    return { slug: recordSlug(number) };
  });
}

export async function reviewerQueue(reviewerId: string) {
  const assignments = await prisma.reviewAssignment.findMany({
    where: { reviewerId },
    orderBy: { createdAt: "desc" },
    include: {
      record: { include: { currentVersion: { select: { title: true, abstract: true } } } },
      review: true,
    },
  });
  return assignments.map((a) => ({
    assignmentId: a.id,
    slug: recordSlug(a.record.paidNumber),
    title: a.record.currentVersion?.title ?? "(untitled)",
    status: a.status,
    dueAt: a.dueAt?.toISOString() ?? null,
    submitted: Boolean(a.review),
    recommendation: a.review?.recommendation ?? null,
  }));
}
