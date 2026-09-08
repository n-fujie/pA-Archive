import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTIONS = [
  "PUBLISH",
  "UNPUBLISH",
  "METADATA_UPDATE",
  "FILE_UPLOAD",
  "FILE_REPLACE",
  "REVIEW_ASSIGNMENT",
  "REVIEW_SUBMISSION",
  "IDENTIFIER_GENERATION",
  "DOI_REGISTRATION",
  "DOI_REGISTRATION_FAILED",
  "RETRACTION",
  "CORRECTION",
  "WITHDRAWAL",
  "USER_ROLE_CHANGE",
];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 100;
  const where = sp.action ? { action: sp.action as never } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 text-xs">
        <a href="/admin/audit" className={!sp.action ? "font-semibold" : ""}>
          All
        </a>
        {ACTIONS.map((a) => (
          <a key={a} href={`/admin/audit?action=${a}`} className={sp.action === a ? "font-semibold" : ""}>
            {a}
          </a>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">{total} entries</p>
      <table className="table-academic mt-2">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Actor</th>
            <th>Target</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-xs">{formatDate(l.createdAt)}</td>
              <td className="text-xs">{l.action}</td>
              <td className="text-xs">{l.actor?.email ?? "system"}</td>
              <td className="text-xs">
                {l.targetType}
                {l.targetId ? `:${l.targetId.slice(0, 8)}` : ""}
              </td>
              <td className="text-xs">{l.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex gap-3 text-sm">
        {page > 1 && (
          <a href={`/admin/audit?${sp.action ? `action=${sp.action}&` : ""}page=${page - 1}`}>← Newer</a>
        )}
        {page * pageSize < total && (
          <a href={`/admin/audit?${sp.action ? `action=${sp.action}&` : ""}page=${page + 1}`}>Older →</a>
        )}
      </div>
    </div>
  );
}
