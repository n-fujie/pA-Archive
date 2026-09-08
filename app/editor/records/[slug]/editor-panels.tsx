"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  addRelationshipAction,
  assignReviewerAction,
  promoteReviewAction,
  setStatusAction,
} from "@/app/editor/actions";
import { RELATION_TYPE_VALUES } from "@/lib/validation/schemas";
import type { FormState } from "@/app/submit/actions";

function Btn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary !text-sm">
      {pending ? "Working…" : label}
    </button>
  );
}

function Note({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-ok">
          Done.{state.warnings?.map((w) => <span key={w}> {w}</span>)}
        </p>
      )}
    </>
  );
}

export function AssignReviewerPanel({
  slug,
  reviewers,
}: {
  slug: string;
  reviewers: { id: string; label: string }[];
}) {
  const [state, action] = useFormState(
    (p: FormState, fd: FormData) => assignReviewerAction(slug, p, fd),
    {} as FormState,
  );
  return (
    <form action={action} className="space-y-2">
      <Note state={state} />
      <select name="reviewerId" className="input" required>
        <option value="">— select reviewer —</option>
        {reviewers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <input type="date" name="dueAt" className="input" />
      <Btn label="Assign reviewer" />
    </form>
  );
}

export function SetStatusPanel({ slug, current }: { slug: string; current: string }) {
  const [state, action] = useFormState(
    (p: FormState, fd: FormData) => setStatusAction(slug, p, fd),
    {} as FormState,
  );
  return (
    <form action={action} className="space-y-2">
      <Note state={state} />
      <select name="status" defaultValue={current} className="input">
        {["NOT_REVIEWED", "UNDER_REVIEW", "REVISION_REQUESTED", "ACCEPTED", "REJECTED", "PUBLISHED"].map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ").toLowerCase()}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-faint">
        A “Peer reviewed” badge appears publicly only when this is set to
        Accepted or Published.
      </p>
      <Btn label="Update status" />
    </form>
  );
}

export function PromoteReviewButton({ reviewId }: { reviewId: string }) {
  const [state, action] = useFormState(() => promoteReviewAction(reviewId), {} as FormState);
  return (
    <form action={action}>
      <Note state={state} />
      <button type="submit" className="btn btn-secondary !text-xs">
        Publish this review as a citable record
      </button>
    </form>
  );
}

export function AddRelationshipPanel({ slug }: { slug: string }) {
  const [state, action] = useFormState(
    (p: FormState, fd: FormData) => addRelationshipAction(slug, p, fd),
    {} as FormState,
  );
  return (
    <form action={action} className="space-y-2">
      <Note state={state} />
      <select name="relationType" className="input">
        {RELATION_TYPE_VALUES.map((r) => (
          <option key={r} value={r}>
            {r.replace(/_/g, " ").toLowerCase()}
          </option>
        ))}
      </select>
      <input name="targetRecordId" placeholder="Target record (slug e.g. 000002)" className="input" />
      <input name="targetIdentifier" placeholder="or external identifier (DOI/URL)" className="input" />
      <input name="note" placeholder="Note (optional)" className="input" />
      <Btn label="Add relationship" />
    </form>
  );
}
