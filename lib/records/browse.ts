import { prisma } from "@/lib/db";
import { recordSlug } from "@/lib/identifiers/paid";

export interface RecordCardData {
  slug: string;
  title: string;
  authors: string[];
  year: number | null;
  publicationType: string;
  category: string;
  identifier: string;
  doi: string | null;
  isPeerReviewed: boolean;
  status: string;
}

export async function latestRecords(limit = 10): Promise<RecordCardData[]> {
  const records = await prisma.record.findMany({
    where: { status: { in: ["PUBLISHED", "RETRACTED"] }, currentVersion: { is: { state: "PUBLISHED" } } },
    orderBy: { firstPublishedAt: "desc" },
    take: limit,
    include: {
      currentVersion: {
        include: { recordAuthors: { include: { author: true }, orderBy: { position: "asc" } } },
      },
      identifiers: true,
    },
  });
  return records.map((r) => {
    const v = r.currentVersion!;
    return {
      slug: recordSlug(r.paidNumber),
      title: v.title,
      authors: v.recordAuthors.map((ra) => ra.author.fullName),
      year: (v.publicationDate ?? r.firstPublishedAt)?.getUTCFullYear() ?? null,
      publicationType: r.publicationType,
      category: r.category,
      identifier: r.identifiers.find((i) => i.type === "PAID")?.value ?? "",
      doi: r.identifiers.find((i) => i.type === "DOI" && i.status === "REGISTERED")?.value ?? null,
      isPeerReviewed: r.peerReviewStatus === "ACCEPTED" || r.peerReviewStatus === "PUBLISHED",
      status: r.status,
    };
  });
}

export async function archiveStats() {
  const [published, peerReviewed, withDoi, categoriesRaw] = await Promise.all([
    prisma.record.count({ where: { status: { in: ["PUBLISHED", "RETRACTED"] } } }),
    prisma.record.count({ where: { peerReviewStatus: { in: ["ACCEPTED", "PUBLISHED"] } } }),
    prisma.identifier.count({ where: { type: "DOI", status: "REGISTERED" } }),
    prisma.record.groupBy({
      by: ["category"],
      where: { status: { in: ["PUBLISHED", "RETRACTED"] } },
      _count: { category: true },
    }),
  ]);
  return {
    published,
    peerReviewed,
    withDoi,
    categories: categoriesRaw
      .map((c) => ({ slug: c.category, count: c._count.category }))
      .sort((a, b) => b.count - a.count),
  };
}
