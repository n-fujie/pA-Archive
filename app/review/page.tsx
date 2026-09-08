import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { reviewerQueue } from "@/lib/reviews/service";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Review queue", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const user = await requireRole("REVIEWER", "/review");
  const queue = await reviewerQueue(user.id);

  return (
    <div>
      <h1 className="text-xl font-semibold">Review queue</h1>
      <p className="mt-1 text-sm text-ink-muted">Records assigned to you for peer review.</p>

      {queue.length === 0 ? (
        <p className="prose-academic mt-6">No review assignments.</p>
      ) : (
        <table className="table-academic mt-4">
          <thead>
            <tr>
              <th>Record</th>
              <th>Identifier</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((q) => (
              <tr key={q.assignmentId}>
                <td>
                  <Link href={`/records/${q.slug}`}>{q.title}</Link>
                </td>
                <td className="font-mono text-xs">{q.slug}</td>
                <td className="text-xs">{q.dueAt ? formatDate(q.dueAt) : "—"}</td>
                <td className="text-xs">
                  {q.submitted ? `submitted (${q.recommendation?.toLowerCase()})` : q.status.toLowerCase()}
                </td>
                <td>
                  <Link href={`/review/${q.slug}`} className="text-xs">
                    {q.submitted ? "Edit review" : "Write review"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
