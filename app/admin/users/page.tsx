import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { CreateUserForm, RoleForm, ToggleDisabledButton } from "./user-forms";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submittedRecords: true, peerReviews: true } } },
  });

  return (
    <div className="space-y-6">
      <details className="card p-3">
        <summary className="cursor-pointer text-sm font-semibold">Create a user</summary>
        <div className="mt-3 max-w-md">
          <CreateUserForm />
        </div>
      </details>

      <div className="overflow-x-auto">
        <table className="table-academic">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Records</th>
              <th>Reviews</th>
              <th>Joined</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-mono text-xs">{u.email}</td>
                <td className="text-xs">{u.name ?? "—"}</td>
                <td>
                  <RoleForm userId={u.id} current={u.role} />
                </td>
                <td className="text-xs">{u._count.submittedRecords}</td>
                <td className="text-xs">{u._count.peerReviews}</td>
                <td className="text-xs">{formatDate(u.createdAt)}</td>
                <td className="text-xs">
                  {u.disabled ? <span className="badge badge-danger">disabled</span> : "active"}
                  <div className="mt-1">
                    <ToggleDisabledButton userId={u.id} disabled={u.disabled} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-faint">
        Role hierarchy: admin &gt; editor &gt; reviewer &gt; submitter &gt; reader.
        Authorization is enforced server-side on every protected action.
      </p>
    </div>
  );
}
