"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  newVersionAction,
  noticeAction,
  publishAction,
  unpublishAction,
  type FormState,
} from "@/app/submit/actions";

function Pending({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Working…" : children}</>;
}

export function PublishButton({ slug }: { slug: string }) {
  const [state, action] = useFormState(
    (prev: FormState) => publishAction(slug, prev),
    {} as FormState,
  );
  return (
    <form action={action} className="space-y-2">
      {state.error && (
        <p className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
          {state.fieldErrors && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {Object.entries(state.fieldErrors).map(([k, v]) => (
                <li key={k}>
                  {k}: {v.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </p>
      )}
      {state.ok && (
        <p className="rounded-sm border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">
          Published.
          {state.warnings?.map((w) => (
            <span key={w} className="mt-1 block text-xs text-warn">
              {w}
            </span>
          ))}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        <Pending>Validate & publish</Pending>
      </button>
      <p className="text-xs text-ink-muted">
        Publishing runs metadata validation, confirms at least one file and a
        license, records the publication timestamp, confirms the P/A Identifier,
        and — if a DOI registrar is connected — submits a DOI. A DOI failure does
        not block publication.
      </p>
    </form>
  );
}

export function NewVersionButton({ slug }: { slug: string }) {
  const [state, action] = useFormState(() => newVersionAction(slug), {} as FormState);
  return (
    <form action={action}>
      {state.error && <p className="mb-1 text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn btn-secondary !text-sm">
        <Pending>Create new version</Pending>
      </button>
    </form>
  );
}

export function UnpublishButton({ slug }: { slug: string }) {
  const [state, action] = useFormState(() => unpublishAction(slug), {} as FormState);
  return (
    <form action={action}>
      {state.error && <p className="mb-1 text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn btn-danger !text-sm">
        <Pending>Withdraw from public view</Pending>
      </button>
    </form>
  );
}

export function NoticeForm({ slug }: { slug: string }) {
  const [state, action] = useFormState(
    (prev: FormState, fd: FormData) => noticeAction(slug, prev, fd),
    {} as FormState,
  );
  return (
    <form action={action} className="space-y-2">
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-ok">Notice recorded.</p>}
      <div>
        <label className="field-label" htmlFor="notice-type">
          Notice type
        </label>
        <select id="notice-type" name="type" className="input">
          <option value="CORRECTION">Correction (record stays published)</option>
          <option value="RETRACTION">Retraction (record marked retracted, kept online)</option>
          <option value="WITHDRAWAL">Withdrawal (record removed from public listings, tombstone kept)</option>
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="notice-reason">
          Reason / statement
        </label>
        <textarea id="notice-reason" name="reason" rows={3} className="input" required />
      </div>
      <div>
        <label className="field-label" htmlFor="notice-url">
          Details URL (optional)
        </label>
        <input id="notice-url" name="detailsUrl" type="url" className="input" />
      </div>
      <button type="submit" className="btn btn-danger !text-sm">
        <Pending>Record notice</Pending>
      </button>
      <p className="text-xs text-ink-faint">
        Notices are permanent. History is never deleted — corrections and
        retractions are added as part of the scholarly record.
      </p>
    </form>
  );
}
