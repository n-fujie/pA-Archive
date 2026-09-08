import { identifierProviderStatus } from "@/lib/identifiers";
import { failedDoiIdentifiers } from "@/lib/admin/stats";
import { env } from "@/lib/env";
import { recordSlug } from "@/lib/identifiers/paid";
import { formatDate } from "@/lib/format";
import { RetryDoiButton } from "./retry-form";

export const dynamic = "force-dynamic";

export default async function AdminIdentifiersPage() {
  const status = identifierProviderStatus();
  const failed = await failedDoiIdentifiers();

  return (
    <div className="space-y-6">
      <div className="card p-4 text-sm">
        <h2 className="font-semibold">Provider configuration</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <Row k="DOI_PROVIDER" v={env.doiProvider} />
          <Row k="Formal DOI enabled" v={String(status.formalDoiEnabled)} />
          <Row k="Active provider" v={status.activeProvider} />
          <Row k="Crossref prefix set" v={String(Boolean(env.crossref.prefix))} />
          <Row k="Crossref credentials set" v={String(Boolean(env.crossref.username && env.crossref.password))} />
          <Row k="DataCite prefix set" v={String(Boolean(env.datacite.prefix))} />
          <Row k="DataCite credentials set" v={String(Boolean(env.datacite.username && env.datacite.password))} />
          <Row k="DOI suffix namespace" v={env.doiSuffixNamespace} />
        </dl>
        <p className="mt-3 border-l-2 border-rule pl-3 text-xs text-ink-muted">{status.message}</p>
        {!status.formalDoiEnabled && (
          <p className="mt-2 text-xs text-ink-faint">
            While no registrar is connected, every record is issued a P/A
            Identifier only. The system does not display any value as a
            registered DOI.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          DOI registrations needing attention
        </h2>
        {failed.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            {status.formalDoiEnabled
              ? "No failed or pending DOI registrations."
              : "Not applicable — no DOI registrar is connected."}
          </p>
        ) : (
          <table className="table-academic mt-2">
            <thead>
              <tr>
                <th>DOI</th>
                <th>Record</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last attempt</th>
                <th>Last error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {failed.map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs">{i.value}</td>
                  <td className="font-mono text-xs">{recordSlug(i.record.paidNumber)}</td>
                  <td className="text-xs">{i.status}</td>
                  <td className="text-xs">{i.attemptCount}</td>
                  <td className="text-xs">{i.lastAttemptAt ? formatDate(i.lastAttemptAt) : "—"}</td>
                  <td className="max-w-[280px] truncate text-xs text-danger">{i.lastError ?? "—"}</td>
                  <td>
                    <RetryDoiButton identifierId={i.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-mono text-xs text-ink-muted">{k}</dt>
      <dd className="font-mono text-xs">{v}</dd>
    </div>
  );
}
