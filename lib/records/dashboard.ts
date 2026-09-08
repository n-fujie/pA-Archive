import { prisma } from "@/lib/db";
import { recordSlug } from "@/lib/identifiers/paid";
import type { Role } from "@prisma/client";

export async function listUserRecords(userId: string, role: Role) {
  const where =
    role === "EDITOR" || role === "ADMIN" ? {} : { submitterId: userId };
  const records = await prisma.record.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      currentVersion: { select: { title: true, state: true, versionLabel: true, versionNumber: true } },
      identifiers: { where: { type: "PAID" }, take: 1 },
      _count: { select: { versions: true, peerReviews: true } },
      submitter: { select: { email: true, name: true } },
    },
  });
  return records.map((r) => ({
    slug: recordSlug(r.paidNumber),
    title: r.currentVersion?.title ?? "(untitled)",
    status: r.status,
    versionState: r.currentVersion?.state ?? "DRAFT",
    versionLabel: r.currentVersion?.versionLabel ?? "v1",
    peerReviewStatus: r.peerReviewStatus,
    identifier: r.identifiers[0]?.value ?? "",
    versionCount: r._count.versions,
    reviewCount: r._count.peerReviews,
    updatedAt: r.updatedAt.toISOString(),
    submitter: r.submitter.name ?? r.submitter.email,
  }));
}

export async function loadEditableRecord(slugNumber: number) {
  const record = await prisma.record.findUnique({
    where: { paidNumber: slugNumber },
    include: {
      currentVersion: {
        include: {
          license: true,
          files: { orderBy: { createdAt: "asc" } },
          recordAuthors: { include: { author: true }, orderBy: { position: "asc" } },
        },
      },
      identifiers: true,
      notices: { orderBy: { createdAt: "desc" } },
      versions: { orderBy: { versionNumber: "asc" }, select: { versionNumber: true, versionLabel: true, state: true, publishedAt: true } },
      peerReviews: {
        include: { reviewer: { select: { name: true, email: true } } },
        orderBy: { submittedAt: "desc" },
      },
      reviewAssignments: {
        include: { reviewer: { select: { name: true, email: true } } },
      },
    },
  });
  return record;
}

export async function listLicenses() {
  return prisma.license.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}
