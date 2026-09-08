import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth, canManageRecord } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { loadEditableRecord, listLicenses } from "@/lib/records/dashboard";
import { MetadataForm } from "@/components/metadata-form";
import { FileManager } from "@/components/file-manager";
import { PublishButton } from "@/components/record-manage-actions";
import { saveDraftAction } from "@/app/submit/actions";

export const metadata: Metadata = { title: "Edit record", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireAuth(`/dashboard/records/${slug}/edit`);
  const num = parseRecordSlug(slug);
  if (num === null) notFound();

  const guard = await prisma.record.findUnique({
    where: { paidNumber: num },
    select: { submitterId: true },
  });
  if (!guard) notFound();
  if (!canManageRecord(user, guard)) redirect("/403");

  const record = await loadEditableRecord(num);
  const v = record?.currentVersion;
  if (!record || !v) notFound();

  const licenses = await listLicenses();
  const editable = v.state === "DRAFT";

  const initial = {
    title: v.title,
    subtitle: v.subtitle ?? "",
    abstract: v.abstract,
    keywords: v.keywords.join(", "),
    language: v.language,
    publicationType: v.publicationType,
    category: record.category,
    licenseCode: v.license?.code ?? "",
    publicationDate: v.publicationDate ? v.publicationDate.toISOString().slice(0, 10) : "",
    references: v.references,
    conflictOfInterest: v.conflictOfInterest,
    ethicsStatement: v.ethicsStatement,
    versionLabel: v.versionLabel,
    authors: v.recordAuthors.map((ra) => ({
      fullName: ra.author.fullName,
      givenName: ra.author.givenName ?? "",
      familyName: ra.author.familyName ?? "",
      orcid: ra.author.orcid ?? "",
      affiliation: ra.affiliationOverride ?? ra.author.affiliation ?? "",
      isCorresponding: ra.isCorresponding,
    })),
    relatedIdentifiers: Array.isArray(v.relatedIdentifiers)
      ? (v.relatedIdentifiers as { identifier: string; scheme: string; relation: string }[])
      : [],
    funding: Array.isArray(v.funding)
      ? (v.funding as { funder: string; awardNumber?: string; awardTitle?: string }[])
      : [],
  };

  const save = saveDraftAction.bind(null, slug);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="max-w-3xl">
        <p className="text-xs text-ink-faint">
          <Link href={`/dashboard/records/${slug}`}>← Back to record</Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">
          Edit {initial.title || "(untitled)"} — {v.versionLabel}
        </h1>
        {!editable && (
          <p className="mt-2 rounded-sm border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            This version is published and its metadata is locked. Create a new
            version from the record page to make changes.
          </p>
        )}

        <div className="mt-6">
          <MetadataForm
            action={editable ? save : async () => ({ error: "Version is locked." })}
            initial={initial}
            licenses={licenses.map((l) => ({ code: l.code, name: l.name }))}
            submitLabel="Save metadata"
            mode="edit"
          />
        </div>
      </div>

      <aside className="space-y-6">
        <div className="card p-3">
          <h2 className="text-sm font-semibold">Files</h2>
          <div className="mt-2">
            <FileManager
              slug={slug}
              editable={editable}
              files={v.files
                .filter((f) => !f.supersededById)
                .map((f) => ({
                  id: f.id,
                  originalName: f.originalName,
                  contentType: f.contentType,
                  byteSize: f.byteSize,
                  label: f.label,
                }))}
            />
          </div>
        </div>

        {editable && (
          <div className="card p-3">
            <h2 className="text-sm font-semibold">Publish</h2>
            <div className="mt-2">
              <PublishButton slug={slug} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
