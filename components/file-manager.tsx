"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatBytes } from "@/lib/format";

export interface ExistingFile {
  id: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  label: string | null;
}

export function FileManager({
  slug,
  files,
  editable,
}: {
  slug: string;
  files: ExistingFile[];
  editable: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File, replaces?: string) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    if (replaces) fd.set("replaces", replaces);
    const res = await fetch(`/api/records/${slug}/files`, { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Upload failed");
      return;
    }
    router.refresh();
  }

  async function remove(fileId: string) {
    if (!confirm("Remove this file from the draft version?")) return;
    setBusy(true);
    const res = await fetch(`/api/records/${slug}/files?fileId=${fileId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && (
        <p className="mb-2 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {files.length === 0 ? (
        <p className="text-sm text-ink-muted">No files uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span>{f.originalName}</span>
                <div className="font-mono text-[11px] text-ink-faint">
                  {f.contentType} · {formatBytes(f.byteSize)}
                </div>
              </div>
              {editable && (
                <div className="flex items-center gap-3 text-xs">
                  <label className="cursor-pointer text-navy hover:underline">
                    Replace
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload(file, f.id);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button type="button" className="text-danger hover:underline" onClick={() => remove(f.id)}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            className="btn btn-secondary !text-sm"
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : "Upload file"}
          </button>
          <p className="field-hint">
            PDF, DOCX, CSV, JSON, ZIP, images and more. Executable / script files
            are rejected. Replacing a file keeps the previous file in the record
            history.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">
          This version is published. Create a new version to change files.
        </p>
      )}
    </div>
  );
}
