import Link from "next/link";
import { downloadStats } from "@/lib/admin/stats";
import { recordSlug } from "@/lib/identifiers/paid";

export const dynamic = "force-dynamic";

export default async function AdminDownloadsPage() {
  const rows = await downloadStats(30);
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Top downloads (last 30 days)
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">No downloads recorded in this period.</p>
      ) : (
        <table className="table-academic mt-2">
          <thead>
            <tr>
              <th>Record</th>
              <th>Title</th>
              <th>Downloads</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.recordId}>
                <td className="font-mono text-xs">
                  <Link href={`/records/${recordSlug(r.paidNumber)}`}>{recordSlug(r.paidNumber)}</Link>
                </td>
                <td className="text-xs">{r.title}</td>
                <td className="text-xs">{r.downloads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        Download events store a salted one-way hash of the client IP, not the
        address itself.
      </p>
    </div>
  );
}
