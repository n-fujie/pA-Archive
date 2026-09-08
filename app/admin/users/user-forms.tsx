"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  changeRoleAction,
  createUserAction,
  toggleUserDisabledAction,
} from "@/app/admin/actions";
import type { FormState } from "@/app/submit/actions";

const ROLES = ["READER", "SUBMITTER", "REVIEWER", "EDITOR", "ADMIN"];

export function RoleForm({ userId, current }: { userId: string; current: string }) {
  const [state, action] = useFormState(changeRoleAction, {} as FormState);
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="userId" value={userId} />
      <select name="role" defaultValue={current} className="input !py-1 !text-xs">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <SmallSubmit label="Set" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
      {state.ok && <span className="text-[11px] text-ok">✓</span>}
    </form>
  );
}

export function ToggleDisabledButton({ userId, disabled }: { userId: string; disabled: boolean }) {
  const [state, action] = useFormState(toggleUserDisabledAction, {} as FormState);
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="text-[11px] text-navy hover:underline">
        {disabled ? "Re-enable" : "Disable"}
      </button>
      {state.error && <span className="block text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

export function CreateUserForm() {
  const [state, action] = useFormState(createUserAction, {} as FormState);
  return (
    <form action={action} className="space-y-2">
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-ok">User created.</p>}
      <input name="email" type="email" placeholder="Email" required className="input" />
      <input name="name" placeholder="Name" className="input" />
      <input name="password" type="password" placeholder="Temp password (min 10 chars)" required className="input" />
      <select name="role" className="input" defaultValue="SUBMITTER">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <SmallSubmit label="Create user" />
    </form>
  );
}

function SmallSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-secondary !py-1 !text-xs">
      {pending ? "…" : label}
    </button>
  );
}
