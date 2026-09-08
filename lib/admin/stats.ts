import { prisma } from "@/lib/db";
import { identifierProviderStatus } from "@/lib/identifiers";

export async function adminOverview() {
  const [
    users,
    records,
    drafts,
    published,
    retracted,
    withdrawn,
    reviews,
    assignments,
    paidCount,
    doiRegistered,
    doiPending,
    doiFailed,
    downloads,
    storageAgg,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.record.count(),
    prisma.record.count({ where: { status: "DRAFT" } }),
    prisma.record.count({ where: { status: "PUBLISHED" } }),
    prisma.record.count({ where: { status: "RETRACTED" } }),
    prisma.record.count({ where: { status: "WITHDRAWN" } }),
    prisma.peerReview.count(),
    prisma.reviewAssignment.count(),
    prisma.identifier.count({ where: { type: "PAID" } }),
    prisma.identifier.count({ where: { type: "DOI", status: "REGISTERED" } }),
    prisma.identifier.count({ where: { type: "DOI", status: { in: ["PENDING", "RESERVED"] } } }),
    prisma.identifier.count({ where: { type: "DOI", status: "FAILED" } }),
    prisma.downloadEvent.count(),
    prisma.fileObject.aggregate({ _sum: { byteSize: true }, _count: true }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { actor: { select: { email: true } } },
    }),
  ]);

  const usersByRole = await prisma.user.groupBy({ by: ["role"], _count: { role: true } });

  return {
    identifier: identifierProviderStatus(),
    users,
    usersByRole: usersByRole.map((u) => ({ role: u.role, count: u._count.role })),
    records: { total: records, drafts, published, retracted, withdrawn },
    reviews: { total: reviews, assignments },
    identifiers: { paidCount, doiRegistered, doiPending, doiFailed },
    downloads,
    storage: { bytes: storageAgg._sum.byteSize ?? 0, files: storageAgg._count },
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      actor: a.actor?.email ?? "system",
      summary: a.summary,
      targetType: a.targetType,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function failedDoiIdentifiers() {
  return prisma.identifier.findMany({
    where: { type: "DOI", status: { in: ["FAILED", "PENDING"] } },
    include: { record: { select: { paidNumber: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function downloadStats(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const events = await prisma.downloadEvent.groupBy({
    by: ["recordId"],
    where: { createdAt: { gte: since } },
    _count: { recordId: true },
    orderBy: { _count: { recordId: "desc" } },
    take: 20,
  });
  const records = await prisma.record.findMany({
    where: { id: { in: events.map((e) => e.recordId) } },
    include: { currentVersion: { select: { title: true } } },
  });
  const map = new Map(records.map((r) => [r.id, r]));
  return events.map((e) => ({
    recordId: e.recordId,
    paidNumber: map.get(e.recordId)?.paidNumber ?? 0,
    title: map.get(e.recordId)?.currentVersion?.title ?? "(unknown)",
    downloads: e._count.recordId,
  }));
}
