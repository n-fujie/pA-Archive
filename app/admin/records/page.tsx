import Link from "next/link";
import { prisma } from "@/lib/db";
import { recordSlug } from "@/lib/identifiers/paid";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminRecordsPage() {
  const records = await prisma.record.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      currentVersion: { select: { title: true, state: true } },
      identifiers: true,
      submitter: { select: { email: true } },
      _count: { select: { versions: true, downloadEvents: true } },
    },
  });

  return (
    <div className="overflow-x-auto">
      <table className="table-academic">
        <thead>
          <tr>
            <th>PAID</th>
            <th>Title</th>
            <th>Submitter</th>
            <th>Status</th>
            <th>Version</th>
            <th>DOI</th>
            <th>Downloads</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const doi = r.identifiers.find((i) => i.type === "DOI");
            return (
              <tr key={r.id}>
                <td className="font-mono text-xs">
                  <Link href={`/dashboard/records/${recordSlug(r.paidNumber)}`}>
                    {r.identifiers.find((i) => i.type === "PAID")?.value ?? recordSlug(r.paidNumber)}
                  </Link>
                </td>
                <td className="text-xs">{r.currentVersion?.title ?? "(untitled)"}</td>
                <td className="text-xs">{r.submitter.email}</td>
                <td className="text-xs">{r.status}</td>
                <td className="text-xs">
                  {r.currentVersion?.state} ({r._count.versions})
                </td>
                <td className="text-xs">
                  {doi ? `${doi.status}` : "—"}
                </td>
                <td className="text-xs">{r._count.downloadEvents}</td>
                <td className="text-xs">{formatDate(r.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
