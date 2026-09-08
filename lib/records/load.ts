import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPaid, recordSlug } from "@/lib/identifiers/paid";
import type {
  AuthorView,
  FileView,
  IdentifierView,
  RecordView,
  RelationView,
} from "./types";

const versionInclude = {
  license: true,
  recordAuthors: { include: { author: true }, orderBy: { position: "asc" } },
  files: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.RecordVersionInclude;

const recordInclude = {
  identifiers: { orderBy: { createdAt: "asc" } },
  notices: { orderBy: { createdAt: "desc" } },
  versions: {
    include: versionInclude,
    orderBy: { versionNumber: "asc" },
  },
  relationsFrom: { include: { targetRecord: true } },
  _count: { select: { downloadEvents: true } },
} satisfies Prisma.RecordInclude;

type RecordWith = Prisma.RecordGetPayload<{ include: typeof recordInclude }>;
type VersionWith = Prisma.RecordVersionGetPayload<{ include: typeof versionInclude }>;

export interface LoadOptions {
  versionNumber?: number;
  /** Allow returning DRAFT records / unpublished versions (owner / staff view). */
  includeUnpublished?: boolean;
}

export async function loadRecordView(
  slugNumber: number,
  opts: LoadOptions = {},
): Promise<RecordView | null> {
  const record = await prisma.record.findUnique({
    where: { paidNumber: slugNumber },
    include: recordInclude,
  });
  if (!record) return null;

  if (!opts.includeUnpublished && record.status === "DRAFT") return null;

  const publishedVersions = record.versions.filter((v) => v.state === "PUBLISHED");
  const pool = opts.includeUnpublished ? record.versions : publishedVersions;
  if (pool.length === 0) return null;

  let version: VersionWith | undefined;
  if (opts.versionNumber) {
    version = pool.find((v) => v.versionNumber === opts.versionNumber);
  } else if (record.currentVersionId) {
    version = pool.find((v) => v.id === record.currentVersionId);
  }
  version ??= pool[pool.length - 1];
  if (!version) return null;

  return mapToView(record, version, publishedVersions);
}

export async function loadRecordViewById(
  recordId: string,
  opts: LoadOptions = {},
): Promise<RecordView | null> {
  const record = await prisma.record.findUnique({ where: { id: recordId } });
  if (!record) return null;
  return loadRecordView(record.paidNumber, opts);
}

function mapToView(
  record: RecordWith,
  version: VersionWith,
  publishedVersions: VersionWith[],
): RecordView {
  const slug = recordSlug(record.paidNumber);
  const base = env.siteUrl;
  const isCurrent =
    record.currentVersionId === version.id ||
    version.versionNumber ===
      Math.max(...publishedVersions.map((v) => v.versionNumber), version.versionNumber);
  const canonicalUrl = isCurrent
    ? `${base}/records/${slug}`
    : `${base}/records/${slug}?version=${version.versionNumber}`;

  const authors: AuthorView[] = version.recordAuthors.map((ra) => ({
    fullName: ra.author.fullName,
    givenName: ra.author.givenName,
    familyName: ra.author.familyName,
    orcid: ra.author.orcid,
    affiliation: ra.affiliationOverride ?? ra.author.affiliation,
    isCorresponding: ra.isCorresponding,
  }));

  const files: FileView[] = version.files
    .filter((f) => !f.supersededById)
    .map((f) => ({
      id: f.id,
      originalName: f.originalName,
      contentType: f.contentType,
      byteSize: f.byteSize,
      checksumSha256: f.checksumSha256,
      label: f.label,
      isPrimary: f.isPrimary,
      downloadPath: `/api/files/${f.id}/download`,
      createdAt: f.createdAt.toISOString(),
    }));

  const identifiers: IdentifierView[] = record.identifiers.map((i) => ({
    type: i.type,
    value: i.value,
    status: i.status,
    provider: i.provider,
    isPrimary: i.isPrimary,
    isRegisteredDoi: i.type === "DOI" && i.status === "REGISTERED",
    registeredAt: i.registeredAt?.toISOString() ?? null,
  }));

  const paid =
    identifiers.find((i) => i.type === "PAID") ??
    ({
      type: "PAID",
      value: formatPaid(record.paidYear, record.paidNumber),
      status: "LOCAL",
      provider: "local",
      isPrimary: true,
      isRegisteredDoi: false,
      registeredAt: null,
    } as IdentifierView);

  const registeredDoiRow = identifiers.find((i) => i.isRegisteredDoi);
  const registeredDoi = registeredDoiRow ? registeredDoiRow.value : null;
  const primaryIdentifier = registeredDoiRow ?? paid;

  const relations: RelationView[] = record.relationsFrom.map((r) => ({
    relationType: r.relationType,
    targetSlug: r.targetRecord ? recordSlug(r.targetRecord.paidNumber) : null,
    targetTitle: null,
    targetIdentifier:
      r.targetIdentifier ??
      (r.targetRecord ? formatPaid(r.targetRecord.paidYear, r.targetRecord.paidNumber) : null),
    note: r.note,
  }));

  const isPeerReviewed =
    record.peerReviewStatus === "ACCEPTED" || record.peerReviewStatus === "PUBLISHED";

  const relatedIdentifiers = Array.isArray(version.relatedIdentifiers)
    ? (version.relatedIdentifiers as { identifier: string; scheme: string; relation: string }[])
    : [];
  const funding = Array.isArray(version.funding)
    ? (version.funding as { funder: string; awardNumber?: string; awardTitle?: string }[])
    : [];

  return {
    slug,
    recordId: record.id,
    status: record.status,
    category: record.category,
    paidYear: record.paidYear,
    paidNumber: record.paidNumber,

    title: version.title,
    subtitle: version.subtitle,
    abstract: version.abstract,
    keywords: version.keywords,
    language: version.language,
    publicationType: version.publicationType,
    publicationDate: version.publicationDate?.toISOString() ?? null,
    references: version.references,
    relatedIdentifiers,
    funding,
    conflictOfInterest: version.conflictOfInterest,
    ethicsStatement: version.ethicsStatement,

    versionNumber: version.versionNumber,
    versionLabel: version.versionLabel,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    firstPublishedAt: record.firstPublishedAt?.toISOString() ?? null,

    license: version.license
      ? { code: version.license.code, name: version.license.name, url: version.license.url }
      : null,
    authors,
    files,
    identifiers,
    relations,
    notices: record.notices.map((n) => ({
      type: n.type,
      reason: n.reason,
      detailsUrl: n.detailsUrl,
      createdAt: n.createdAt.toISOString(),
    })),
    versionHistory: publishedVersions.map((v) => ({
      versionNumber: v.versionNumber,
      versionLabel: v.versionLabel,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      isCurrent: v.id === record.currentVersionId,
      slug: v.id === record.currentVersionId ? slug : `${slug}?version=${v.versionNumber}`,
    })),

    peerReviewStatus: record.peerReviewStatus,
    isPeerReviewed,
    downloadCount: record._count.downloadEvents,

    primaryIdentifier,
    registeredDoi,
    canonicalUrl,
  };
}
