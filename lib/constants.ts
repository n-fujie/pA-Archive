import type { PublicationType, Role } from "@prisma/client";

export const ROLE_LEVEL: Record<Role, number> = {
  READER: 0,
  SUBMITTER: 1,
  REVIEWER: 2,
  EDITOR: 3,
  ADMIN: 4,
};

export const ROLE_LABEL: Record<Role, string> = {
  READER: "Reader",
  SUBMITTER: "Submitter",
  REVIEWER: "Reviewer",
  EDITOR: "Editor",
  ADMIN: "Administrator",
};

export const PUBLICATION_TYPES: { value: PublicationType; label: string }[] = [
  { value: "JOURNAL_ARTICLE", label: "Journal Article" },
  { value: "PREPRINT", label: "Preprint" },
  { value: "BOOK", label: "Book" },
  { value: "BOOK_CHAPTER", label: "Book Chapter" },
  { value: "WORKING_PAPER", label: "Working Paper" },
  { value: "RESEARCH_NOTE", label: "Research Note" },
  { value: "DATASET", label: "Dataset" },
  { value: "SOFTWARE", label: "Software" },
  { value: "PEER_REVIEW", label: "Peer Review" },
  { value: "REPORT", label: "Report" },
  { value: "THESIS", label: "Thesis" },
  { value: "PRESENTATION", label: "Presentation" },
  { value: "OTHER", label: "Other" },
];

export const PUBLICATION_TYPE_LABEL: Record<PublicationType, string> =
  Object.fromEntries(
    PUBLICATION_TYPES.map((t) => [t.value, t.label]),
  ) as Record<PublicationType, string>;

// Maps our publication types to schema.org types (best-effort).
export const SCHEMA_ORG_TYPE: Record<PublicationType, string> = {
  JOURNAL_ARTICLE: "ScholarlyArticle",
  PREPRINT: "ScholarlyArticle",
  BOOK: "Book",
  BOOK_CHAPTER: "Chapter",
  WORKING_PAPER: "ScholarlyArticle",
  RESEARCH_NOTE: "ScholarlyArticle",
  DATASET: "Dataset",
  SOFTWARE: "SoftwareSourceCode",
  PEER_REVIEW: "Review",
  REPORT: "Report",
  THESIS: "Thesis",
  PRESENTATION: "PresentationDigitalDocument",
  OTHER: "CreativeWork",
};

export const CATEGORIES: { slug: string; label: string }[] = [
  { slug: "philosophy", label: "Philosophy" },
  { slug: "design-theory", label: "Design Theory" },
  { slug: "cognitive-science", label: "Cognitive Science" },
  { slug: "systems-theory", label: "Systems Theory" },
  { slug: "mathematics", label: "Mathematics" },
  { slug: "computation", label: "Computation" },
  { slug: "physics", label: "Physics" },
  { slug: "biomechanics", label: "Biomechanics" },
  { slug: "methodology", label: "Methodology" },
  { slug: "governance", label: "Governance & Ethics" },
  { slug: "other", label: "Other" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "zh", label: "Chinese" },
  { code: "other", label: "Other" },
];

// Allowed upload types. Executable / script types are rejected outright.
export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "md",
  "csv",
  "tsv",
  "json",
  "jsonld",
  "xml",
  "bib",
  "ris",
  "zip",
  "tar",
  "gz",
  "7z",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "tif",
  "tiff",
  "xlsx",
  "xls",
  "ods",
  "pptx",
  "ppt",
  "parquet",
  "nc",
  "h5",
  "hdf5",
  "fits",
  "wav",
  "mp3",
  "mp4",
  "mov",
] as const;

export const BLOCKED_UPLOAD_EXTENSIONS = [
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "com",
  "msi",
  "bat",
  "cmd",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "psm1",
  "vbs",
  "js",
  "mjs",
  "cjs",
  "jar",
  "app",
  "apk",
  "deb",
  "rpm",
  "scr",
  "pif",
  "reg",
  "wsf",
  "gadget",
  "workflow",
];

export const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.oasis.opendocument",
  "application/json",
  "application/ld+json",
  "application/xml",
  "text/",
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "application/x-7z-compressed",
  "application/octet-stream", // allowed but extension check still applies
  "image/",
  "audio/",
  "video/",
];
