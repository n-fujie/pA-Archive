import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnedAuditSession } from "@/lib/research-audit/access";
import { loadAuditSession } from "@/lib/research-audit/load";
import { formatDate } from "@/lib/format";
import { AuditWorkspace } from "@/components/audit/workspace";

export const metadata: Metadata = { title: "Audit session", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AuditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwnedAuditSession(id, `/audit/${id}`);
  const view = await loadAuditSession(id);
  if (!view) notFound();

  if (view.status === "FAILED") {
    return (
      <div className="max-w-prose">
        <p className="text-xs text-ink-faint">
          <Link href="/audit">← Research audit</Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">{view.title}</h1>
        <p className="mt-2 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          The audit could not complete: {view.failureReason}
        </p>
      </div>
    );
  }
  if (view.status !== "READY") {
    return (
      <div className="max-w-prose">
        <h1 className="text-xl font-semibold">{view.title}</h1>
        <p className="prose-academic mt-2">Processing ({view.status.toLowerCase()})… reload shortly.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-ink-faint">
            <Link href="/audit">← Research audit</Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold">{view.title}</h1>
          <p className="text-xs text-ink-muted">
            {view.methodologyVersion} · completed {formatDate(view.completedAt)} · uploaded by {view.uploader.name}
            {view.recordSlug && (
              <>
                {" "}·{" "}
                <Link href={`/records/${view.recordSlug}`}>record {view.recordSlug}</Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <AuditWorkspace view={view} mode="standard" />
      </div>

      {view.aiOperations.length === 0 && (
        <p className="mt-6 text-[11px] text-ink-faint">
          No AI operations were run for this session. Every finding here is either extracted from the document or produced
          by a deterministic rule over the document text.
        </p>
      )}
    </div>
  );
}
