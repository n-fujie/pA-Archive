import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { loadEditableRecord } from "@/lib/records/dashboard";
import { formatDate } from "@/lib/format";
import {
  AddRelationshipPanel,
  AssignReviewerPanel,
  PromoteReviewButton,
  SetStatusPanel,
} from "./editor-panels";

export const metadata: Metadata = { title: "Editorial record", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditorRecordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole("EDITOR", "/editor");
  const { slug } = await params;
  const num = parseRecordSlug(slug);
  if (num === null) notFound();

  const record = await loadEditableRecord(num);
  if (!record) notFound();

  const reviewers = await prisma.user.findMany({
    where: { role: { in: ["REVIEWER", "EDITOR", "ADMIN"] }, disabled: false },
    select: { id: true, name: true, email: true },
    orderBy: { email: "asc" },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <p className="text-xs text-ink-faint">
          <Link href="/editor">← Editorial overview</Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">{record.currentVersion?.title}</h1>
        <p className="mt-1 text-sm">
          <Link href={`/records/${slug}`}>Public page</Link> ·{" "}
          <Link href={`/dashboard/records/${slug}`}>Submission dashboard</Link>
        </p>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Review assignments
          </h2>
          {record.reviewAssignments.length === 0 ? (
            <p className="mt-1 text-sm text-ink-muted">No reviewers assigned.</p>
          ) : (
            <table className="table-academic mt-2">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {record.reviewAssignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.reviewer.name ?? a.reviewer.email}</td>
                    <td className="text-xs">{a.status.toLowerCase()}</td>
                    <td className="text-xs">{a.dueAt ? formatDate(a.dueAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Submitted reviews
          </h2>
          {record.peerReviews.length === 0 ? (
            <p className="mt-1 text-sm text-ink-muted">No reviews submitted.</p>
          ) : (
            <ul className="mt-2 space-y-3 text-sm">
              {record.peerReviews.map((pr) => (
                <li key={pr.id} className="card p-3">
                  <p className="text-xs text-ink-muted">
                    {pr.reviewer.name ?? pr.reviewer.email} ·{" "}
                    {pr.recommendation.replace(/_/g, " ").toLowerCase()} · {formatDate(pr.submittedAt)} ·{" "}
                    {pr.isPublic ? "consented to publish" : "confidential"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{pr.body}</p>
                  {pr.confidential && (
                    <p className="mt-2 border-l-2 border-warn pl-2 text-xs text-ink-muted">
                      Confidential to editor: {pr.confidential}
                    </p>
                  )}
                  {pr.isPublic && !pr.reviewRecordId && (
                    <div className="mt-2">
                      <PromoteReviewButton reviewId={pr.id} />
                    </div>
                  )}
                  {pr.reviewRecordId && (
                    <p className="mt-2 text-xs text-ok">Published as an independent record.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <div className="card p-3">
          <h2 className="text-sm font-semibold">Assign reviewer</h2>
          <div className="mt-2">
            <AssignReviewerPanel
              slug={slug}
              reviewers={reviewers.map((r) => ({ id: r.id, label: r.name ? `${r.name} (${r.email})` : r.email }))}
            />
          </div>
        </div>

        <div className="card p-3">
          <h2 className="text-sm font-semibold">Peer review status</h2>
          <div className="mt-2">
            <SetStatusPanel slug={slug} current={record.peerReviewStatus} />
          </div>
        </div>

        <div className="card p-3">
          <h2 className="text-sm font-semibold">Add relationship</h2>
          <div className="mt-2">
            <AddRelationshipPanel slug={slug} />
          </div>
        </div>
      </aside>
    </div>
  );
}
