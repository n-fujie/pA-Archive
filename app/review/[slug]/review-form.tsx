"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitReviewAction } from "../actions";
import type { FormState } from "@/app/submit/actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? "Submitting…" : "Submit review"}
    </button>
  );
}

export function ReviewForm({
  assignmentId,
  initial,
}: {
  assignmentId: string;
  initial?: { recommendation: string; body: string; confidential: string; isPublic: boolean };
}) {
  const action = submitReviewAction.bind(null, assignmentId);
  const [state, formAction] = useFormState(action, {} as FormState);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      {state.error && (
        <p className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-sm border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">
          Review submitted.
        </p>
      )}
      <div>
        <label className="field-label" htmlFor="recommendation">
          Recommendation
        </label>
        <select
          id="recommendation"
          name="recommendation"
          className="input"
          defaultValue={initial?.recommendation ?? "NONE"}
        >
          <option value="NONE">No recommendation</option>
          <option value="ACCEPT">Accept</option>
          <option value="MINOR_REVISION">Minor revision</option>
          <option value="MAJOR_REVISION">Major revision</option>
          <option value="REJECT">Reject</option>
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="body">
          Review (may be published alongside the record)
        </label>
        <textarea id="body" name="body" rows={10} required defaultValue={initial?.body} className="input" />
      </div>
      <div>
        <label className="field-label" htmlFor="confidential">
          Confidential comments to the editor
        </label>
        <textarea
          id="confidential"
          name="confidential"
          rows={4}
          defaultValue={initial?.confidential}
          className="input"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublic" defaultChecked={initial?.isPublic} />
        I consent to this review being published as an open, citable record
      </label>
      <SubmitBtn />
    </form>
  );
}
