import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnedAuditSession } from "@/lib/research-audit/access";
import { loadAuditSession } from "@/lib/research-audit/load";
import { AuditWorkspace } from "@/components/audit/workspace";

export const metadata: Metadata = { title: "Advanced audit view", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdvancedAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwnedAuditSession(id, `/audit/${id}/advanced`);
  const view = await loadAuditSession(id);
  if (!view || view.status !== "READY") notFound();

  return (
    <div>
      <p className="text-xs text-ink-faint">
        <Link href={`/audit/${id}`}>← {view.title}</Link>
      </p>
      <h1 className="mt-1 text-xl font-semibold">Advanced Audit View</h1>
      <p className="max-w-prose text-sm text-ink-muted">
        Category Ignition, Boundary / Scale Audit, Transition Audit, History Reinjection, Address / Domain Analysis,
        Counterfactual Audit, Theory Mine Audit, Regression Audit. Panels for stages that did not fire say so and why.
      </p>
      <div className="mt-4">
        <AuditWorkspace view={view} mode="advanced" />
      </div>
    </div>
  );
}
