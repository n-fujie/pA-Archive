import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { loadRecordView } from "@/lib/records/load";
import { getSessionUser, canManageRecord } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  CATEGORY_LABEL,
  PUBLICATION_TYPE_LABEL,
} from "@/lib/constants";
import { formatBytes, formatDate } from "@/lib/format";
import { toJsonLd } from "@/lib/metadata";
import { citationIdentifier } from "@/lib/citation";
import { CiteWidget } from "@/components/cite-widget";
import { MetadataLinks } from "@/components/metadata-links";

interface Params {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ version?: string }>;
}

async function resolve(params: Params["params"], searchParams: Params["searchParams"]) {
  const { slug } = await params;
  const sp = await searchParams;
  const num = parseRecordSlug(slug);
  if (num === null) return null;
  const versionNumber = sp.version ? Number.parseInt(sp.version, 10) : undefined;
  const view = await loadRecordView(num, {
    versionNumber: Number.isFinite(versionNumber) ? versionNumber : undefined,
  });
  return view;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const view = await resolve(params, searchParams);
  if (!view) return { title: "Record not found", robots: { index: false } };

  // Highwire / Google Scholar citation tags.
  const other: Record<string, string | string[]> = {
    citation_title: view.title,
    citation_author: view.authors.map((a) => a.fullName),
    citation_publication_date: (view.publicationDate ?? view.publishedAt ?? "").slice(0, 10),
    citation_language: view.language,
    citation_public_url: view.canonicalUrl,
    citation_technical_report_institution: process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute",
  };
  const pdf = view.files.find((f) => f.contentType === "application/pdf");
  if (pdf) other.citation_pdf_url = `${process.env.NEXT_PUBLIC_SITE_URL}${pdf.downloadPath}`;
  // citation_doi is emitted ONLY when a DOI is genuinely registered.
  if (view.registeredDoi) other.citation_doi = view.registeredDoi;
  if (view.keywords.length) other.citation_keywords = view.keywords.join("; ");

  return {
    title: view.title,
    description: view.abstract.slice(0, 300),
    alternates: { canonical: view.canonicalUrl },
    robots:
      view.status === "WITHDRAWN"
        ? { index: false, follow: true }
        : { index: true, follow: true },
    openGraph: {
      title: view.title,
      description: view.abstract.slice(0, 300),
      url: view.canonicalUrl,
      type: "article",
    },
    other,
  };
}

export default async function RecordPage({ params, searchParams }: Params) {
  const view = await resolve(params, searchParams);
  if (!view) notFound();

  const user = await getSessionUser();
  let canManage = false;
  if (user) {
    const rec = await prisma.record.findUnique({
      where: { id: view.recordId },
      select: { submitterId: true },
    });
    canManage = rec ? canManageRecord(user, rec) : false;
  }

  const jsonLd = toJsonLd(view);
  const activeNotice = view.notices[0];

  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div>
        {view.status === "RETRACTED" && (
          <div className="mb-4 border-l-4 border-danger bg-danger/5 p-3">
            <p className="text-sm font-semibold text-danger">This record has been retracted.</p>
            {activeNotice && <p className="mt-1 text-sm text-ink-soft">{activeNotice.reason}</p>}
            <p className="mt-1 text-xs text-ink-faint">
              The record and its files remain available as part of the scholarly
              record.
            </p>
          </div>
        )}
        {view.status === "WITHDRAWN" && (
          <div className="mb-4 border-l-4 border-warn bg-warn/5 p-3">
            <p className="text-sm font-semibold text-warn">This record has been withdrawn.</p>
            {activeNotice && <p className="mt-1 text-sm text-ink-soft">{activeNotice.reason}</p>}
          </div>
        )}
        {view.notices.some((n) => n.type === "CORRECTION") && view.status === "PUBLISHED" && (
          <div className="mb-4 border-l-4 border-navy bg-navy/5 p-3">
            <p className="text-sm font-semibold text-navy">A correction has been issued for this record.</p>
            <p className="mt-1 text-sm text-ink-soft">
              {view.notices.find((n) => n.type === "CORRECTION")?.reason}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="uppercase tracking-wide text-ink-muted">
            {PUBLICATION_TYPE_LABEL[view.publicationType] ?? view.publicationType}
          </span>
          <span className="text-ink-faint">·</span>
          <Link href={`/records?category=${view.category}`} className="text-ink-muted">
            {CATEGORY_LABEL[view.category] ?? view.category}
          </Link>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-muted">Version {view.versionLabel}</span>
          {view.isPeerReviewed ? (
            <span className="badge badge-review">Peer reviewed</span>
          ) : (
            <span className="badge badge-warn">Not peer reviewed</span>
          )}
        </div>

        <h1 className="mt-2 text-2xl font-semibold leading-tight">{view.title}</h1>
        {view.subtitle && <p className="mt-1 text-lg text-ink-soft">{view.subtitle}</p>}

        <div className="mt-3 text-sm">
          {view.authors.map((a, i) => (
            <span key={i}>
              {i > 0 && "; "}
              {a.orcid ? (
                <a href={`https://orcid.org/${a.orcid}`} target="_blank" rel="noreferrer noopener">
                  {a.fullName}
                </a>
              ) : (
                <span>{a.fullName}</span>
              )}
              {a.isCorresponding && <span title="Corresponding author"> *</span>}
            </span>
          ))}
        </div>
        {view.authors.some((a) => a.affiliation) && (
          <ul className="mt-1 text-xs text-ink-muted">
            {[...new Set(view.authors.map((a) => a.affiliation).filter(Boolean))].map((aff) => (
              <li key={aff as string}>{aff}</li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-sm text-ink-muted">
          Published {formatDate(view.firstPublishedAt ?? view.publishedAt)}
          {view.publicationDate && ` · Publication date ${formatDate(view.publicationDate)}`}
        </p>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Abstract</h2>
          <div className="prose-academic mt-2 whitespace-pre-wrap">{view.abstract}</div>
        </section>

        {view.keywords.length > 0 && (
          <section className="mt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Keywords</h2>
            <p className="mt-1 text-sm">
              {view.keywords.map((k, i) => (
                <span key={k}>
                  {i > 0 && ", "}
                  <Link href={`/search?keyword=${encodeURIComponent(k)}`}>{k}</Link>
                </span>
              ))}
            </p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Files</h2>
          {view.files.length === 0 ? (
            <p className="mt-1 text-sm text-ink-muted">No files.</p>
          ) : (
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {view.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <a href={f.downloadPath}>{f.originalName}</a>
                    {f.label && <span className="ml-2 text-xs text-ink-faint">{f.label}</span>}
                    <div className="font-mono text-[11px] text-ink-faint">
                      {f.contentType} · {formatBytes(f.byteSize)}
                      {f.checksumSha256 && ` · sha256:${f.checksumSha256.slice(0, 16)}…`}
                    </div>
                  </div>
                  <a href={f.downloadPath} className="btn btn-secondary !py-1 !text-xs no-underline hover:no-underline">
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-ink-faint">{view.downloadCount} downloads recorded</p>
        </section>

        {view.references.trim() && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">References</h2>
            <div className="prose-academic mt-2 whitespace-pre-wrap text-sm">{view.references}</div>
          </section>
        )}

        {(view.relatedIdentifiers.length > 0 || view.relations.length > 0) && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Related works</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {view.relations.map((r, i) => (
                <li key={`rel-${i}`}>
                  <span className="text-ink-muted">{r.relationType.replace(/_/g, " ").toLowerCase()}:</span>{" "}
                  {r.targetSlug ? (
                    <Link href={`/records/${r.targetSlug}`}>{r.targetIdentifier ?? r.targetSlug}</Link>
                  ) : (
                    <span className="font-mono">{r.targetIdentifier}</span>
                  )}
                </li>
              ))}
              {view.relatedIdentifiers.map((r, i) => (
                <li key={`ri-${i}`}>
                  <span className="text-ink-muted">{r.relation.replace(/_/g, " ").toLowerCase()}:</span>{" "}
                  <span className="font-mono">{r.identifier}</span>{" "}
                  <span className="text-xs text-ink-faint">({r.scheme})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(view.funding.length > 0 || view.conflictOfInterest || view.ethicsStatement) && (
          <section className="mt-6 space-y-3 text-sm">
            {view.funding.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Funding</h2>
                <ul className="mt-1 list-disc pl-5">
                  {view.funding.map((f, i) => (
                    <li key={i}>
                      {f.funder}
                      {f.awardNumber ? ` — ${f.awardNumber}` : ""}
                      {f.awardTitle ? ` (${f.awardTitle})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {view.conflictOfInterest && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  Conflict of interest
                </h2>
                <p className="mt-1 whitespace-pre-wrap">{view.conflictOfInterest}</p>
              </div>
            )}
            {view.ethicsStatement && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  Ethics statement
                </h2>
                <p className="mt-1 whitespace-pre-wrap">{view.ethicsStatement}</p>
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-5 text-sm">
        {canManage && (
          <div className="card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Manage</p>
            <div className="mt-2 flex flex-col gap-1">
              <Link href={`/dashboard/records/${view.slug}`}>Open in dashboard</Link>
            </div>
          </div>
        )}

        <div className="card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Identifier</p>
          <p className="mt-1 font-mono text-xs">
            <span className="badge badge-paid">P/A ID</span> {view.primaryIdentifier.type === "PAID" ? view.primaryIdentifier.value : view.identifiers.find((i) => i.type === "PAID")?.value}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">Landing page: {view.canonicalUrl}</p>
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">DOI</p>
            {view.registeredDoi ? (
              <p className="mt-1 font-mono text-xs">
                <span className="badge badge-doi">DOI</span>{" "}
                <a href={`https://doi.org/${view.registeredDoi}`}>https://doi.org/{view.registeredDoi}</a>
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-faint">
                No registered DOI. Cite the P/A Identifier or the landing page URL
                above.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Cite</p>
          <div className="mt-2">
            <CiteWidget view={view} />
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">Cite as: {citationIdentifier(view)}</p>
        </div>

        <div className="card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Peer review status
          </p>
          <p className="mt-1">{view.peerReviewStatus.replace(/_/g, " ").toLowerCase()}</p>
        </div>

        <div className="card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">License</p>
          <p className="mt-1">
            {view.license ? (
              view.license.url ? (
                <a href={view.license.url}>{view.license.name}</a>
              ) : (
                view.license.name
              )
            ) : (
              "Not specified"
            )}
          </p>
        </div>

        {view.versionHistory.length > 1 && (
          <div className="card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Version history
            </p>
            <ul className="mt-1 space-y-1">
              {view.versionHistory.map((v) => (
                <li key={v.versionNumber}>
                  <Link href={`/records/${v.slug}`}>
                    {v.versionLabel}
                    {v.isCurrent ? " (current)" : ""}
                  </Link>{" "}
                  <span className="text-xs text-ink-faint">{formatDate(v.publishedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Machine-readable metadata
          </p>
          <div className="mt-2">
            <MetadataLinks view={view} />
          </div>
        </div>
      </aside>
    </article>
  );
}
