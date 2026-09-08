import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { recordSlug } from "@/lib/identifiers/paid";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Editorial", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditorPage() {
  await requireRole("EDITOR", "/editor");

  const records = await prisma.record.findMany({
    where: { status: { in: ["PUBLISHED", "DRAFT", "RETRACTED"] } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      currentVersion: { select: { title: true, state: true } },
      _count: { select: { reviewAssignments: true, peerReviews: true } },
      identifiers: { where: { type: "PAID" }, take: 1 },
    },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Editorial overview</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Assign reviewers, set peer review status, manage relationships and
        notices.
      </p>
      <table className="table-academic mt-4">
        <thead>
          <tr>
            <th>Title</th>
            <th>Identifier</th>
            <th>Status</th>
            <th>Peer review</th>
            <th>Reviews</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/editor/records/${recordSlug(r.paidNumber)}`}>
                  {r.currentVersion?.title ?? "(untitled)"}
                </Link>
              </td>
              <td className="font-mono text-xs">{r.identifiers[0]?.value}</td>
              <td className="text-xs">{r.status}</td>
              <td className="text-xs">{r.peerReviewStatus.replace(/_/g, " ").toLowerCase()}</td>
              <td className="text-xs">
                {r._count.peerReviews}/{r._count.reviewAssignments}
              </td>
              <td className="text-xs">{formatDate(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
