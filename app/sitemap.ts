import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { recordSlug } from "@/lib/identifiers/paid";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/records",
    "/search",
    "/about",
    "/terms",
    "/privacy",
    "/contact",
    "/policies/publication",
    "/policies/peer-review",
    "/policies/research-integrity",
    "/policies/retraction",
    "/policies/copyright",
  ].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly", priority: path === "" ? 1 : 0.5 }));

  // Only PUBLISHED and RETRACTED records are indexable; WITHDRAWN and DRAFT are not.
  let records: { paidNumber: number; lastPublishedAt: Date | null; updatedAt: Date }[] = [];
  try {
    records = await prisma.record.findMany({
      where: { status: { in: ["PUBLISHED", "RETRACTED"] }, currentVersion: { is: { state: "PUBLISHED" } } },
      select: { paidNumber: true, lastPublishedAt: true, updatedAt: true },
      orderBy: { firstPublishedAt: "desc" },
      take: 50_000,
    });
  } catch {
    // Database not reachable (e.g. at build time) — emit static routes only.
  }

  return [
    ...staticRoutes,
    ...records.map((r) => ({
      url: `${base}/records/${recordSlug(r.paidNumber)}`,
      lastModified: r.lastPublishedAt ?? r.updatedAt,
      changeFrequency: "yearly" as const,
      priority: 0.8,
    })),
  ];
}
