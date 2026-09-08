import { SCHEMA_ORG_TYPE } from "@/lib/constants";
import { env } from "@/lib/env";
import type { RecordView } from "@/lib/records/types";
import { toBibtex, toRis } from "@/lib/citation";

/**
 * Machine-readable metadata serialisers.
 *
 * DOI rule: `citation_doi`, JSON-LD `sameAs`/`identifier` DOI entries, and any
 * "doi" field are emitted ONLY when view.registeredDoi is set (a persisted,
 * REGISTERED DOI). The P/A Identifier is always emitted.
 */

export function toJsonLd(view: RecordView): Record<string, unknown> {
  const operator = env.operatorName;
  const service = env.serviceName;

  const identifiers: unknown[] = [
    {
      "@type": "PropertyValue",
      propertyID: "PAID",
      value: view.primaryIdentifier.value,
    },
  ];
  const sameAs: string[] = [view.canonicalUrl];
  if (view.registeredDoi) {
    identifiers.push({
      "@type": "PropertyValue",
      propertyID: "DOI",
      value: view.registeredDoi,
    });
    sameAs.push(`https://doi.org/${view.registeredDoi}`);
  }

  const doc: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_ORG_TYPE[view.publicationType] ?? "CreativeWork",
    "@id": view.canonicalUrl,
    url: view.canonicalUrl,
    name: view.title,
    headline: view.title,
    ...(view.subtitle ? { alternativeHeadline: view.subtitle } : {}),
    ...(view.abstract ? { abstract: view.abstract, description: view.abstract } : {}),
    inLanguage: view.language,
    identifier: identifiers,
    sameAs,
    ...(view.registeredDoi ? { "doi": view.registeredDoi } : {}),
    author: view.authors.map((a) => ({
      "@type": "Person",
      name: a.fullName,
      ...(a.familyName ? { familyName: a.familyName } : {}),
      ...(a.givenName ? { givenName: a.givenName } : {}),
      ...(a.orcid ? { identifier: `https://orcid.org/${a.orcid}`, sameAs: `https://orcid.org/${a.orcid}` } : {}),
      ...(a.affiliation ? { affiliation: { "@type": "Organization", name: a.affiliation } } : {}),
    })),
    ...(view.publicationDate || view.publishedAt
      ? { datePublished: (view.publicationDate ?? view.publishedAt)!.slice(0, 10) }
      : {}),
    publisher: { "@type": "Organization", name: operator },
    provider: { "@type": "Organization", name: operator },
    isPartOf: { "@type": "CreativeWorkSeries", name: service, url: env.siteUrl },
    ...(view.keywords.length ? { keywords: view.keywords } : {}),
    ...(view.license?.url ? { license: view.license.url } : view.license ? { license: view.license.code } : {}),
    version: view.versionLabel,
    creativeWorkStatus:
      view.status === "RETRACTED"
        ? "Retracted"
        : view.status === "WITHDRAWN"
          ? "Withdrawn"
          : "Published",
    ...(view.files.length
      ? {
          associatedMedia: view.files.map((f) => ({
            "@type": "MediaObject",
            contentUrl: `${env.siteUrl}${f.downloadPath}`,
            encodingFormat: f.contentType,
            contentSize: String(f.byteSize),
            name: f.originalName,
          })),
        }
      : {}),
  };

  if (view.isPeerReviewed) {
    doc["review"] = {
      "@type": "Review",
      reviewAspect: "Peer review",
      author: { "@type": "Organization", name: operator },
    };
  }
  return doc;
}

/** Dublin Core (simple DC as flat key/values; also renderable as XML). */
export function toDublinCore(view: RecordView): Record<string, string[]> {
  const operator = env.operatorName;
  const dc: Record<string, string[]> = {
    "dc.title": [view.title],
    "dc.creator": view.authors.map((a) => a.fullName),
    "dc.subject": view.keywords,
    "dc.description": view.abstract ? [view.abstract] : [],
    "dc.publisher": [operator],
    "dc.date": [(view.publicationDate ?? view.publishedAt ?? "").slice(0, 10)].filter(Boolean),
    "dc.type": [view.publicationType],
    "dc.language": [view.language],
    "dc.identifier": [view.primaryIdentifier.value, view.canonicalUrl],
    "dc.rights": view.license ? [view.license.url ?? view.license.code] : [],
  };
  if (view.registeredDoi) {
    dc["dc.identifier"].push(`https://doi.org/${view.registeredDoi}`);
    dc["dc.relation"] = [`https://doi.org/${view.registeredDoi}`];
  }
  return dc;
}

export function toDublinCoreXml(view: RecordView): string {
  const dc = toDublinCore(view);
  const body = Object.entries(dc)
    .flatMap(([k, values]) =>
      values.filter(Boolean).map((v) => `  <${k.replace(".", ":")}>${escapeXml(v)}</${k.replace(".", ":")}>`),
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
           xmlns:dc="http://purl.org/dc/elements/1.1/">
${body}
</oai_dc:dc>`;
}

/** Full metadata bundle returned by GET /api/records/:id/metadata?format=json */
export function toMetadataJson(view: RecordView): Record<string, unknown> {
  return {
    identifier: {
      paid: view.primaryIdentifier.value,
      paidStatus: view.primaryIdentifier.status,
      doi: view.registeredDoi, // null unless a DOI is genuinely registered
      landingPage: view.canonicalUrl,
    },
    title: view.title,
    subtitle: view.subtitle,
    abstract: view.abstract,
    authors: view.authors,
    keywords: view.keywords,
    language: view.language,
    publicationType: view.publicationType,
    category: view.category,
    publicationDate: view.publicationDate,
    firstPublishedAt: view.firstPublishedAt,
    version: {
      number: view.versionNumber,
      label: view.versionLabel,
      publishedAt: view.publishedAt,
      history: view.versionHistory,
    },
    license: view.license,
    status: view.status,
    peerReview: {
      status: view.peerReviewStatus,
      isPeerReviewed: view.isPeerReviewed,
    },
    references: view.references,
    relatedIdentifiers: view.relatedIdentifiers,
    relations: view.relations,
    funding: view.funding,
    conflictOfInterest: view.conflictOfInterest,
    ethicsStatement: view.ethicsStatement,
    notices: view.notices,
    files: view.files.map((f) => ({
      name: f.originalName,
      contentType: f.contentType,
      byteSize: f.byteSize,
      checksumSha256: f.checksumSha256,
      downloadUrl: `${env.siteUrl}${f.downloadPath}`,
    })),
    downloadCount: view.downloadCount,
    schemaOrg: toJsonLd(view),
  };
}

export function metadataInFormat(
  view: RecordView,
  format: string,
): { body: string; contentType: string; filename: string } {
  switch (format) {
    case "json-ld":
    case "jsonld":
      return {
        body: JSON.stringify(toJsonLd(view), null, 2),
        contentType: "application/ld+json",
        filename: `${view.slug}.jsonld`,
      };
    case "bibtex":
      return { body: toBibtex(view), contentType: "application/x-bibtex", filename: `${view.slug}.bib` };
    case "ris":
      return { body: toRis(view), contentType: "application/x-research-info-systems", filename: `${view.slug}.ris` };
    case "dublin-core":
    case "dc":
      return { body: toDublinCoreXml(view), contentType: "application/xml", filename: `${view.slug}.dc.xml` };
    case "json":
    default:
      return {
        body: JSON.stringify(toMetadataJson(view), null, 2),
        contentType: "application/json",
        filename: `${view.slug}.json`,
      };
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
