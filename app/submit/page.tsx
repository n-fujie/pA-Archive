import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guards";
import { listLicenses } from "@/lib/records/dashboard";
import { MetadataForm } from "@/components/metadata-form";
import { createDraftAction } from "./actions";

export const metadata: Metadata = { title: "Submit research", robots: { index: false } };

export default async function SubmitPage() {
  await requireAuth("/submit");
  const licenses = await listLicenses();

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">New submission</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Enter the descriptive metadata for your work. After saving, you will
        upload files and then publish. Nothing is public until you publish.
      </p>
      <div className="mt-6">
        <MetadataForm
          action={createDraftAction}
          licenses={licenses.map((l) => ({ code: l.code, name: l.name }))}
          submitLabel="Create draft & continue"
          mode="create"
        />
      </div>
    </div>
  );
}
