import { z } from "zod";

export const PUBLICATION_TYPE_VALUES = [
  "JOURNAL_ARTICLE",
  "PREPRINT",
  "BOOK",
  "BOOK_CHAPTER",
  "WORKING_PAPER",
  "RESEARCH_NOTE",
  "DATASET",
  "SOFTWARE",
  "PEER_REVIEW",
  "REPORT",
  "THESIS",
  "PRESENTATION",
  "OTHER",
] as const;

export const RELATION_TYPE_VALUES = [
  "REVIEWS",
  "IS_REVIEWED_BY",
  "IS_NEW_VERSION_OF",
  "IS_PREVIOUS_VERSION_OF",
  "CITES",
  "IS_SUPPLEMENT_TO",
  "IS_SUPPLEMENTED_BY",
  "CORRECTS",
  "IS_CORRECTED_BY",
] as const;

// ORCID: 0000-0000-0000-000X (last char may be X)
export const orcidRegex = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export const orcidSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/^https?:\/\/orcid\.org\//i, ""))
  .refine((s) => s === "" || orcidRegex.test(s), {
    message: "ORCID must look like 0000-0000-0000-0000",
  })
  .optional()
  .or(z.literal(""));

export const authorSchema = z.object({
  fullName: z.string().trim().min(1, "Author name is required").max(300),
  givenName: z.string().trim().max(150).optional().or(z.literal("")),
  familyName: z.string().trim().max(150).optional().or(z.literal("")),
  orcid: orcidSchema,
  affiliation: z.string().trim().max(300).optional().or(z.literal("")),
  isCorresponding: z.boolean().optional().default(false),
});

export const relatedIdentifierSchema = z.object({
  identifier: z.string().trim().min(1).max(300),
  scheme: z
    .enum(["doi", "url", "handle", "arxiv", "isbn", "pmid", "paid", "other"])
    .default("other"),
  relation: z.enum(RELATION_TYPE_VALUES).default("CITES"),
});

export const fundingSchema = z.object({
  funder: z.string().trim().min(1).max(300),
  awardNumber: z.string().trim().max(150).optional().or(z.literal("")),
  awardTitle: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Metadata accepted when SAVING A DRAFT — permissive, only title required. */
export const draftMetadataSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  subtitle: z.string().trim().max(500).optional().or(z.literal("")),
  abstract: z.string().trim().max(20_000).optional().or(z.literal("")),
  keywords: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
  language: z.string().trim().min(2).max(20).default("en"),
  publicationType: z.enum(PUBLICATION_TYPE_VALUES).default("OTHER"),
  category: z.string().trim().min(1).max(60).default("other"),
  licenseCode: z.string().trim().max(60).optional().or(z.literal("")),
  publicationDate: z
    .string()
    .trim()
    .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Invalid date")
    .optional()
    .or(z.literal("")),
  references: z.string().trim().max(50_000).optional().or(z.literal("")),
  relatedIdentifiers: z.array(relatedIdentifierSchema).max(100).optional().default([]),
  funding: z.array(fundingSchema).max(50).optional().default([]),
  conflictOfInterest: z.string().trim().max(10_000).optional().or(z.literal("")),
  ethicsStatement: z.string().trim().max(10_000).optional().or(z.literal("")),
  versionLabel: z.string().trim().max(40).optional().or(z.literal("")),
  authors: z.array(authorSchema).max(200).optional().default([]),
});

/** Stricter checks enforced at PUBLISH time. */
export const publishMetadataSchema = draftMetadataSchema.extend({
  abstract: z.string().trim().min(20, "An abstract of at least 20 characters is required").max(20_000),
  authors: z.array(authorSchema).min(1, "At least one author is required").max(200),
  licenseCode: z.string().trim().min(1, "A license must be selected"),
  category: z.string().trim().min(1, "A category is required"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().toLowerCase().email("A valid email is required").max(320),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(200)
      .refine((p) => !/^(.)\1+$/.test(p), "Password is too weak"),
    confirmPassword: z.string(),
    orcid: orcidSchema,
    affiliation: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const reviewAssignmentSchema = z.object({
  reviewerId: z.string().min(1),
  dueAt: z.string().optional().or(z.literal("")),
});

export const reviewSubmissionSchema = z.object({
  recommendation: z
    .enum(["NONE", "ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"])
    .default("NONE"),
  body: z.string().trim().min(1, "Review text is required").max(50_000),
  confidential: z.string().trim().max(20_000).optional().or(z.literal("")),
  isPublic: z.boolean().optional().default(false),
});

export const peerReviewStatusSchema = z.enum([
  "NOT_REVIEWED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "PUBLISHED",
]);

export const noticeSchema = z.object({
  type: z.enum(["CORRECTION", "RETRACTION", "WITHDRAWAL"]),
  reason: z.string().trim().min(10, "A reason of at least 10 characters is required").max(10_000),
  detailsUrl: z.string().trim().url().optional().or(z.literal("")),
});

export const relationshipSchema = z.object({
  targetRecordId: z.string().optional().or(z.literal("")),
  targetIdentifier: z.string().trim().max(300).optional().or(z.literal("")),
  relationType: z.enum(RELATION_TYPE_VALUES),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const roleChangeSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["READER", "SUBMITTER", "REVIEWER", "EDITOR", "ADMIN"]),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().max(300).optional().default(""),
  year: z.string().trim().optional().default(""),
  type: z.string().trim().optional().default(""),
  language: z.string().trim().optional().default(""),
  category: z.string().trim().optional().default(""),
  peerReviewed: z.enum(["", "true", "false"]).optional().default(""),
  author: z.string().trim().max(200).optional().default(""),
  keyword: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  sort: z.enum(["relevance", "newest", "oldest"]).optional().default("newest"),
});

export type DraftMetadataInput = z.infer<typeof draftMetadataSchema>;
export type PublishMetadataInput = z.infer<typeof publishMetadataSchema>;
export type AuthorInput = z.infer<typeof authorSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
