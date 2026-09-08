import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { listUserRecords } from "@/lib/records/dashboard";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");
  const records = await listUserRecords(user.id, user.role);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {user.role === "EDITOR" || user.role === "ADMIN" ? "All submissions" : "My submissions"}
        </h1>
        <Link href="/submit" className="btn btn-primary no-underline hover:no-underline">
          New submission
        </Link>
      </div>

      {records.length === 0 ? (
        <p className="prose-academic mt-6">
          You have no submissions yet. <Link href="/submit">Start one.</Link>
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="table-academic">
            <thead>
              <tr>
                <th>Title</th>
                <th>Identifier</th>
                <th>Status</th>
                <th>Version</th>
                <th>Peer review</th>
                <th>Updated</th>
                {(user.role === "EDITOR" || user.role === "ADMIN") && <th>Submitter</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <Link href={`/dashboard/records/${r.slug}`}>{r.title}</Link>
                  </td>
                  <td className="font-mono text-xs">{r.identifier}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === "PUBLISHED"
                          ? "badge-review"
                          : r.status === "RETRACTED" || r.status === "WITHDRAWN"
                            ? "badge-danger"
                            : "badge-warn"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.versionState === "DRAFT" && r.status === "PUBLISHED" && (
                      <span className="badge badge-warn ml-1">draft v{r.versionLabel}</span>
                    )}
                  </td>
                  <td>{r.versionLabel} ({r.versionCount})</td>
                  <td className="text-xs">{r.peerReviewStatus.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="text-xs">{formatDate(r.updatedAt)}</td>
                  {(user.role === "EDITOR" || user.role === "ADMIN") && (
                    <td className="text-xs">{r.submitter}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
