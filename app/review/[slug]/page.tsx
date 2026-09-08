import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Write review", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WriteReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireRole("REVIEWER", `/review/${slug}`);
  const num = parseRecordSlug(slug);
  if (num === null) notFound();

  const record = await prisma.record.findUnique({
    where: { paidNumber: num },
    include: { currentVersion: { select: { title: true, abstract: true } } },
  });
  if (!record) notFound();

  const assignment = await prisma.reviewAssignment.findUnique({
    where: { recordId_reviewerId: { recordId: record.id, reviewerId: user.id } },
    include: { review: true },
  });
  if (!assignment) {
    return (
      <div className="max-w-prose">
        <h1 className="text-xl font-semibold">Not assigned</h1>
        <p className="prose-academic mt-2">
          You are not assigned to review this record. <Link href="/review">Back to queue</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-ink-faint">
        <Link href="/review">← Review queue</Link>
      </p>
      <h1 className="mt-1 text-xl font-semibold">Review: {record.currentVersion?.title}</h1>
      <p className="mt-1 text-sm">
        <Link href={`/records/${slug}`}>View the record and files →</Link>
      </p>
      <div className="prose-academic mt-3 border-l-2 border-rule pl-3 text-sm">
        {record.currentVersion?.abstract}
      </div>

      <ReviewForm
        assignmentId={assignment.id}
        initial={
          assignment.review
            ? {
                recommendation: assignment.review.recommendation,
                body: assignment.review.body,
                confidential: assignment.review.confidential,
                isPublic: assignment.review.isPublic,
              }
            : undefined
        }
      />
    </div>
  );
}
