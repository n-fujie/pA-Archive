"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function AuditUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    if (title.trim()) fd.set("title", title.trim());
    const res = await fetch("/api/audit", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Upload failed");
      return;
    }
    router.push(`/audit/${body.sessionId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      {error && (
        <p className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <div>
        <label className="field-label" htmlFor="audit-file">
          Research document
        </label>
        <input
          id="audit-file"
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
          required
        />
        <p className="field-hint">PDF, DOCX, Markdown or plain text. The file is parsed and audited; nothing is published.</p>
      </div>
      <div>
        <label className="field-label" htmlFor="audit-title">
          Title (optional)
        </label>
        <input id="audit-title" value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
      </div>
      <button type="submit" disabled={busy || !file} className="btn btn-primary">
        {busy ? "Parsing & auditing…" : "Upload & audit"}
      </button>
      <p className="field-hint">
        The audit surfaces how the document&apos;s claims are generated (categories, configuration, dependencies, history,
        boundaries, scales, inference, simulation, review, institutional conditions) and where they could be revised. It
        does not judge the document true or false. Every result links back to a passage in the document.
      </p>
    </form>
  );
}
