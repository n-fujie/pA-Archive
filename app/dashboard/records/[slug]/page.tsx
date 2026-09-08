import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth, canManageRecord } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { loadEditableRecord } from "@/lib/records/dashboard";
import { formatDate } from "@/lib/format";
import {
  NewVersionButton,
  NoticeForm,
  PublishButton,
  UnpublishButton,
} from "@/components/record-manage-actions";

export const metadata: Metadata = { title: "Manage record", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ManageRecordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireAuth(`/dashboard/records/${slug}`);
  const num = parseRecordSlug(slug);
  if (num === null) notFound();

  const guard = await prisma.record.findUnique({
    where: { paidNumber: num },
    select: { submitterId: true },
  });
  if (!guard) notFound();
  if (!canManageRecord(user, guard)) redirect("/403");

  const record = await loadEditableRecord(num);
  if (!record) notFound();
  const v = record.currentVersion;
  const draftEditable = v?.state === "DRAFT";
  const paid = record.identifiers.find((i) => i.type === "PAID")?.value ?? "";
  const doiRow = record.identifiers.find((i) => i.type === "DOI");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-xs text-ink-faint">
          <Link href="/dashboard">← Dashboard</Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">{v?.title ?? "(untitled)"}</h1>
        <p className="mt-1 font-mono text-xs text-ink-muted">{paid}</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="badge badge-paid">{record.status}</span>
          {v && <span className="badge badge-warn">current version {v.versionLabel} · {v.state}</span>}
          <span className="badge badge-doi">peer review: {record.peerReviewStatus.replace(/_/g, " ").toLowerCase()}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {draftEditable && (
            <Link href={`/dashboard/records/${slug}/edit`} className="btn btn-secondary !text-sm no-underline hover:no-underline">
              Edit metadata & files
            </Link>
          )}
          {record.status === "PUBLISHED" && (
            <Link href={`/records/${slug}`} className="btn btn-secondary !text-sm no-underline hover:no-underline">
              View public page
            </Link>
          )}
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Versions</h2>
          <table className="table-academic mt-2">
            <thead>
              <tr>
                <th>Version</th>
                <th>State</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {record.versions.map((ver) => (
                <tr key={ver.versionNumber}>
                  <td>{ver.versionLabel}</td>
                  <td>{ver.state}</td>
                  <td className="text-xs">{formatDate(ver.publishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {record.status === "PUBLISHED" && v?.state === "PUBLISHED" && (
            <div className="mt-3">
              <NewVersionButton slug={slug} />
            </div>
          )}
        </section>

        {record.peerReviews.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Peer reviews</h2>
            <ul className="mt-2 space-y-3 text-sm">
              {record.peerReviews.map((pr) => (
                <li key={pr.id} className="card p-3">
                  <p className="text-xs text-ink-muted">
                    {pr.reviewer.name ?? pr.reviewer.email} · {pr.recommendation.replace(/_/g, " ").toLowerCase()} ·{" "}
                    {formatDate(pr.submittedAt)} {pr.isPublic ? "· public" : "· confidential"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{pr.body}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {record.notices.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Notices</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {record.notices.map((n) => (
                <li key={n.id} className="border-l-2 border-danger pl-2">
                  <span className="font-semibold">{n.type}</span> · {formatDate(n.createdAt)}
                  <p className="whitespace-pre-wrap text-ink-soft">{n.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="space-y-6">
        {v?.state === "DRAFT" && (
          <div className="card p-3">
            <h2 className="text-sm font-semibold">Publish</h2>
            <div className="mt-2">
              <PublishButton slug={slug} />
            </div>
          </div>
        )}

        <div className="card p-3">
          <h2 className="text-sm font-semibold">Identifiers</h2>
          <p className="mt-1 font-mono text-xs">{paid} · {record.identifiers.find((i) => i.type === "PAID")?.status}</p>
          {doiRow ? (
            <p className="mt-1 font-mono text-xs">
              {doiRow.value} · <span className="uppercase">{doiRow.status}</span>
              {doiRow.status === "FAILED" && doiRow.lastError && (
                <span className="mt-1 block text-danger">{doiRow.lastError}</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">
              No DOI. A DOI is only created when a Crossref/DataCite registrar is
              connected.
            </p>
          )}
        </div>

        {record.status !== "DRAFT" && (
          <details className="card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-danger">
              Correction / Retraction / Withdrawal
            </summary>
            <div className="mt-3">
              <NoticeForm slug={slug} />
            </div>
          </details>
        )}

        {record.status === "PUBLISHED" && (
          <details className="card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-danger">Withdraw</summary>
            <div className="mt-3">
              <UnpublishButton slug={slug} />
            </div>
          </details>
        )}
      </aside>
    </div>
  );
}
