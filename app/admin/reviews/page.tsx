import Link from "next/link";
import { prisma } from "@/lib/db";
import { recordSlug } from "@/lib/identifiers/paid";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const [assignments, reviews] = await Promise.all([
    prisma.reviewAssignment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: { select: { email: true } },
        assignedBy: { select: { email: true } },
        record: { select: { paidNumber: true, currentVersion: { select: { title: true } } } },
      },
    }),
    prisma.peerReview.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        reviewer: { select: { email: true } },
        record: { select: { paidNumber: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Assignments</h2>
        <table className="table-academic mt-2">
          <thead>
            <tr>
              <th>Record</th>
              <th>Reviewer</th>
              <th>Assigned by</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td className="text-xs">
                  <Link href={`/editor/records/${recordSlug(a.record.paidNumber)}`}>
                    {a.record.currentVersion?.title ?? recordSlug(a.record.paidNumber)}
                  </Link>
                </td>
                <td className="text-xs">{a.reviewer.email}</td>
                <td className="text-xs">{a.assignedBy.email}</td>
                <td className="text-xs">{a.status.toLowerCase()}</td>
                <td className="text-xs">{a.dueAt ? formatDate(a.dueAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Submitted reviews</h2>
        <table className="table-academic mt-2">
          <thead>
            <tr>
              <th>Record</th>
              <th>Reviewer</th>
              <th>Recommendation</th>
              <th>Public</th>
              <th>As record</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{recordSlug(r.record.paidNumber)}</td>
                <td className="text-xs">{r.reviewer.email}</td>
                <td className="text-xs">{r.recommendation.replace(/_/g, " ").toLowerCase()}</td>
                <td className="text-xs">{r.isPublic ? "yes" : "no"}</td>
                <td className="text-xs">{r.reviewRecordId ? "published" : "—"}</td>
                <td className="text-xs">{formatDate(r.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
