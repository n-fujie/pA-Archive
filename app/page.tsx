import Link from "next/link";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/constants";
import { archiveStats, latestRecords } from "@/lib/records/browse";
import { identifierProviderStatus } from "@/lib/identifiers";
import { site } from "@/lib/site";
import { SearchBox } from "@/components/search-box";
import { RecordCard } from "@/components/record-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [records, stats] = await Promise.all([latestRecords(12), archiveStats()]);
  const idStatus = identifierProviderStatus();

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
      <div>
        <section className="border-b border-ink pb-6">
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-ink-soft">
            {site.description}
          </p>
          <div className="mt-4 max-w-2xl">
            <SearchBox size="lg" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
            <span>
              <strong className="text-ink">{stats.published}</strong> public records
            </span>
            <span>
              <strong className="text-ink">{stats.peerReviewed}</strong> peer reviewed
            </span>
            <span>
              <strong className="text-ink">{stats.withDoi}</strong> with registered DOI
            </span>
            <Link href="/submit">Deposit your research →</Link>
          </div>
          {!idStatus.formalDoiEnabled && (
            <p className="mt-3 max-w-prose border-l-2 border-rule pl-3 text-xs text-ink-faint">
              Persistent identification is currently provided by P/A Identifiers
              (<span className="font-mono">PAID:YYYY:NNNNNN</span>). These are
              permanent and citable but are <em>not</em> DOIs. A formal DOI is
              registered and shown only when a Crossref or DataCite agreement is
              connected.
            </p>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Latest public records
            </h2>
            <Link href="/records" className="text-xs">
              All records →
            </Link>
          </div>
          <div className="mt-3">
            {records.length === 0 ? (
              <p className="prose-academic">
                No records have been published yet.{" "}
                <Link href="/submit">Be the first to deposit.</Link>
              </p>
            ) : (
              records.map((r) => <RecordCard key={r.slug} r={r} />)
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <div className="card p-4">
          <h2 className="text-sm font-semibold">Deposit research</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Submit an article, preprint, dataset, software, report, thesis, or
            review. Drafts are private until you publish.
          </p>
          <Link href="/submit" className="btn btn-primary mt-3 w-full no-underline hover:no-underline">
            Start a submission
          </Link>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Categories
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {CATEGORIES.map((c) => {
              const count = stats.categories.find((x) => x.slug === c.slug)?.count ?? 0;
              return (
                <li key={c.slug} className="flex justify-between">
                  <Link href={`/records?category=${c.slug}`}>{c.label}</Link>
                  <span className="text-xs text-ink-faint">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-4 text-xs text-ink-muted">
          <h2 className="text-sm font-semibold text-ink">Identifier policy</h2>
          <p className="mt-1">{idStatus.message}</p>
          <Link href="/policies/publication" className="mt-2 inline-block">
            Publication policy →
          </Link>
        </div>
      </aside>
    </div>
  );
}
