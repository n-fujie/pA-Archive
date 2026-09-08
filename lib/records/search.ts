import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordSlug } from "@/lib/identifiers/paid";
import type { SearchQueryInput } from "@/lib/validation/schemas";

export interface SearchHit {
  slug: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  year: number | null;
  publicationType: string;
  category: string;
  language: string;
  abstractSnippet: string;
  identifier: string;
  doi: string | null;
  isPeerReviewed: boolean;
  status: string;
  publishedAt: string | null;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    years: { value: number; count: number }[];
    types: { value: string; count: number }[];
    languages: { value: string; count: number }[];
    categories: { value: string; count: number }[];
  };
}

const PAGE_SIZE = 20;

/**
 * Metadata search across published records. Uses case-insensitive `contains`
 * on the current published version — portable across any PostgreSQL provider
 * without extensions. (A pg_trgm / tsvector upgrade path is noted in the README.)
 */
export async function searchRecords(q: SearchQueryInput): Promise<SearchResult> {
  const page = q.page ?? 1;
  const term = q.q?.trim() ?? "";

  const versionWhere: Prisma.RecordVersionWhereInput = { state: "PUBLISHED" };
  const recordWhere: Prisma.RecordWhereInput = {
    status: { in: ["PUBLISHED", "RETRACTED"] },
    currentVersion: { is: versionWhere },
  };
  const and: Prisma.RecordWhereInput[] = [recordWhere];

  if (term) {
    // Identifier / DOI / ORCID exact-ish match, else full metadata match.
    const idMatch = term.replace(/^https?:\/\/doi\.org\//i, "");
    and.push({
      OR: [
        { currentVersion: { title: { contains: term, mode: "insensitive" } } },
        { currentVersion: { subtitle: { contains: term, mode: "insensitive" } } },
        { currentVersion: { abstract: { contains: term, mode: "insensitive" } } },
        { currentVersion: { keywords: { has: term } } },
        { currentVersion: { keywords: { has: term.toLowerCase() } } },
        { currentVersion: { recordAuthors: { some: { author: { fullName: { contains: term, mode: "insensitive" } } } } } },
        { currentVersion: { recordAuthors: { some: { author: { orcid: idMatch } } } } },
        { identifiers: { some: { value: { contains: idMatch, mode: "insensitive" } } } },
      ],
    });
  }

  if (q.author) {
    and.push({
      currentVersion: {
        recordAuthors: { some: { author: { fullName: { contains: q.author, mode: "insensitive" } } } },
      },
    });
  }
  if (q.keyword) {
    and.push({
      OR: [
        { currentVersion: { keywords: { has: q.keyword } } },
        { currentVersion: { keywords: { has: q.keyword.toLowerCase() } } },
      ],
    });
  }
  if (q.type) and.push({ publicationType: q.type as Prisma.EnumPublicationTypeFilter["equals"] });
  if (q.category) and.push({ category: q.category });
  if (q.language) and.push({ currentVersion: { language: q.language } });
  if (q.peerReviewed === "true") and.push({ peerReviewStatus: { in: ["ACCEPTED", "PUBLISHED"] } });
  if (q.peerReviewed === "false") and.push({ peerReviewStatus: { notIn: ["ACCEPTED", "PUBLISHED"] } });
  if (q.year && /^\d{4}$/.test(q.year)) {
    const y = Number.parseInt(q.year, 10);
    and.push({
      currentVersion: {
        publicationDate: {
          gte: new Date(Date.UTC(y, 0, 1)),
          lt: new Date(Date.UTC(y + 1, 0, 1)),
        },
      },
    });
  }

  const where: Prisma.RecordWhereInput = { AND: and };

  const orderBy: Prisma.RecordOrderByWithRelationInput =
    q.sort === "oldest"
      ? { firstPublishedAt: "asc" }
      : { firstPublishedAt: "desc" };

  const [total, records, allForFacets] = await Promise.all([
    prisma.record.count({ where }),
    prisma.record.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        currentVersion: {
          include: { recordAuthors: { include: { author: true }, orderBy: { position: "asc" } } },
        },
        identifiers: true,
      },
    }),
    prisma.record.findMany({
      where,
      select: {
        publicationType: true,
        category: true,
        firstPublishedAt: true,
        currentVersion: { select: { language: true, publicationDate: true } },
      },
      take: 5000,
    }),
  ]);

  const hits: SearchHit[] = records.map((r) => {
    const v = r.currentVersion!;
    const doi = r.identifiers.find((i) => i.type === "DOI" && i.status === "REGISTERED")?.value ?? null;
    const paid = r.identifiers.find((i) => i.type === "PAID")?.value ?? "";
    const dateStr = (v.publicationDate ?? r.firstPublishedAt)?.toISOString() ?? null;
    return {
      slug: recordSlug(r.paidNumber),
      title: v.title,
      subtitle: v.subtitle,
      authors: v.recordAuthors.map((ra) => ra.author.fullName),
      year: dateStr ? new Date(dateStr).getUTCFullYear() : null,
      publicationType: r.publicationType,
      category: r.category,
      language: v.language,
      abstractSnippet: snippet(v.abstract, term),
      identifier: paid,
      doi,
      isPeerReviewed: r.peerReviewStatus === "ACCEPTED" || r.peerReviewStatus === "PUBLISHED",
      status: r.status,
      publishedAt: r.firstPublishedAt?.toISOString() ?? null,
    };
  });

  const facets = buildFacets(allForFacets);

  return { hits, total, page, pageSize: PAGE_SIZE, facets };
}

function snippet(text: string, term: string): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (!term) return clean.slice(0, 240) + (clean.length > 240 ? "…" : "");
  const idx = clean.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return clean.slice(0, 240) + (clean.length > 240 ? "…" : "");
  const start = Math.max(0, idx - 80);
  return (start > 0 ? "…" : "") + clean.slice(start, start + 240) + "…";
}

function buildFacets(
  rows: {
    publicationType: string;
    category: string;
    firstPublishedAt: Date | null;
    currentVersion: { language: string; publicationDate: Date | null } | null;
  }[],
) {
  const years = new Map<number, number>();
  const types = new Map<string, number>();
  const languages = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const r of rows) {
    const d = r.currentVersion?.publicationDate ?? r.firstPublishedAt;
    if (d) years.set(d.getUTCFullYear(), (years.get(d.getUTCFullYear()) ?? 0) + 1);
    types.set(r.publicationType, (types.get(r.publicationType) ?? 0) + 1);
    categories.set(r.category, (categories.get(r.category) ?? 0) + 1);
    const lang = r.currentVersion?.language ?? "en";
    languages.set(lang, (languages.get(lang) ?? 0) + 1);
  }
  const sortNum = (m: Map<number, number>) =>
    [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.value - a.value);
  const sortStr = (m: Map<string, number>) =>
    [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  return {
    years: sortNum(years),
    types: sortStr(types),
    languages: sortStr(languages),
    categories: sortStr(categories),
  };
}
