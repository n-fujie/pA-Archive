"use client";

import { useFormState, useFormStatus } from "react-dom";
import { retryDoiAction } from "@/app/admin/actions";
import type { FormState } from "@/app/submit/actions";

export function RetryDoiButton({ identifierId }: { identifierId: string }) {
  const [state, action] = useFormState(retryDoiAction, {} as FormState);
  const { pending } = useFormStatus();
  return (
    <form action={action}>
      <input type="hidden" name="identifierId" value={identifierId} />
      <button type="submit" disabled={pending} className="btn btn-secondary !py-1 !text-xs">
        {pending ? "…" : "Retry"}
      </button>
      {state.error && <span className="block text-[11px] text-danger">{state.error}</span>}
      {state.ok && <span className="block text-[11px] text-ok">{state.warnings?.[0]}</span>}
    </form>
  );
}
