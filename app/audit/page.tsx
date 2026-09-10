import type { Metadata } from "next";
import Link from "next/link";
import { hasRole } from "@/lib/auth/guards";
import { requireAuditAccess } from "@/lib/research-audit/access";
import { listAuditSessions } from "@/lib/research-audit/load";
import { formatDate } from "@/lib/format";
import { AuditUploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Research audit", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AuditIndexPage() {
  const user = await requireAuditAccess("/audit");
  const sessions = await listAuditSessions(user.id, hasRole(user.role, "EDITOR"));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-xl font-semibold">Research document audit</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Upload a research document. The system parses it and runs a multi-stage audit of how its claims are generated —
          through which categories, configuration, dependencies, history, boundaries, scales, inference, simulation,
          review and institutional conditions — and where they could be revised. The goal is not to decide the document
          true or false.
        </p>

        {sessions.length === 0 ? (
          <p className="prose-academic mt-6">No audit sessions yet.</p>
        ) : (
          <table className="table-academic mt-6">
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Stages fired</th>
                <th>Findings</th>
                <th>Words</th>
                <th>Created</th>
                {hasRole(user.role, "EDITOR") && <th>Uploader</th>}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/audit/${s.id}`}>{s.title}</Link>
                  </td>
                  <td className="text-xs">{s.status.toLowerCase()}</td>
                  <td className="text-xs">{s.firedStages}</td>
                  <td className="text-xs">{s.findingCount}</td>
                  <td className="text-xs">{s.words ?? "—"}</td>
                  <td className="text-xs">{formatDate(s.createdAt)}</td>
                  {hasRole(user.role, "EDITOR") && <td className="text-xs">{s.uploader}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <aside>
        <AuditUploadForm />
      </aside>
    </div>
  );
}
