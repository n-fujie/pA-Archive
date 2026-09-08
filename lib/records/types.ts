import type {
  IdentifierStatus,
  NoticeType,
  PeerReviewStatus,
  PublicationType,
  RecordStatus,
} from "@prisma/client";

export interface AuthorView {
  fullName: string;
  givenName: string | null;
  familyName: string | null;
  orcid: string | null;
  affiliation: string | null;
  isCorresponding: boolean;
}

export interface FileView {
  id: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string | null;
  label: string | null;
  isPrimary: boolean;
  downloadPath: string; // "/api/files/<id>/download"
  createdAt: string;
}

export interface IdentifierView {
  type: "PAID" | "DOI";
  value: string;
  status: IdentifierStatus;
  provider: string;
  isPrimary: boolean;
  /** True only for a DOI row whose status is REGISTERED. */
  isRegisteredDoi: boolean;
  registeredAt: string | null;
}

export interface RelationView {
  relationType: string;
  targetSlug: string | null;
  targetTitle: string | null;
  targetIdentifier: string | null;
  note: string | null;
}

export interface NoticeView {
  type: NoticeType;
  reason: string;
  detailsUrl: string | null;
  createdAt: string;
}

export interface VersionSummary {
  versionNumber: number;
  versionLabel: string;
  publishedAt: string | null;
  isCurrent: boolean;
  slug: string; // "000001?version=2"
}

export interface RecordView {
  slug: string; // "000001"
  recordId: string;
  status: RecordStatus;
  category: string;
  paidYear: number;
  paidNumber: number;

  title: string;
  subtitle: string | null;
  abstract: string;
  keywords: string[];
  language: string;
  publicationType: PublicationType;
  publicationDate: string | null;
  references: string;
  relatedIdentifiers: { identifier: string; scheme: string; relation: string }[];
  funding: { funder: string; awardNumber?: string; awardTitle?: string }[];
  conflictOfInterest: string;
  ethicsStatement: string;

  versionNumber: number;
  versionLabel: string;
  publishedAt: string | null;
  firstPublishedAt: string | null;

  license: { code: string; name: string; url: string | null } | null;
  authors: AuthorView[];
  files: FileView[];
  identifiers: IdentifierView[];
  relations: RelationView[];
  notices: NoticeView[];
  versionHistory: VersionSummary[];

  peerReviewStatus: PeerReviewStatus;
  isPeerReviewed: boolean; // true ONLY when peerReviewStatus is ACCEPTED or PUBLISHED
  downloadCount: number;

  /** Primary identifier to show as "the" identifier for this record. */
  primaryIdentifier: IdentifierView;
  /** Registered DOI, if and only if one exists. Never a fabricated value. */
  registeredDoi: string | null;

  canonicalUrl: string;
}
