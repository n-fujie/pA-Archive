import { adminOverview } from "@/lib/admin/stats";
import { formatBytes, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const o = await adminOverview();

  return (
    <div className="space-y-6">
      <div
        className={`rounded-sm border p-3 text-sm ${
          o.identifier.formalDoiEnabled
            ? "border-ok/40 bg-ok/10 text-ok"
            : "border-navy/30 bg-navy/5 text-navy"
        }`}
      >
        <strong>Identifier provider:</strong> {o.identifier.message}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Users" value={o.users} />
        <Stat label="Records (total)" value={o.records.total} />
        <Stat label="Published" value={o.records.published} />
        <Stat label="Drafts" value={o.records.drafts} />
        <Stat label="Retracted" value={o.records.retracted} />
        <Stat label="Withdrawn" value={o.records.withdrawn} />
        <Stat label="P/A Identifiers" value={o.identifiers.paidCount} />
        <Stat label="DOIs registered" value={o.identifiers.doiRegistered} />
        <Stat label="DOIs pending" value={o.identifiers.doiPending} />
        <Stat label="DOIs failed" value={o.identifiers.doiFailed} />
        <Stat label="Peer reviews" value={o.reviews.total} />
        <Stat label="Downloads" value={o.downloads} />
        <Stat label="Files" value={o.storage.files} />
        <Stat label="Storage used" value={formatBytes(o.storage.bytes)} />
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Users by role</h2>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm">
          {o.usersByRole.map((u) => (
            <li key={u.role} className="badge badge-paid">
              {u.role}: {u.count}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Recent activity (audit log)
        </h2>
        <table className="table-academic mt-2">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {o.recentAudit.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{formatDate(a.createdAt)}</td>
                <td className="text-xs">{a.action}</td>
                <td className="text-xs">{a.actor}</td>
                <td className="text-xs">{a.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
