"use client";

import { useFormState, useFormStatus } from "react-dom";
import { registerAction, type RegisterState } from "./actions";

const initial: RegisterState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full">
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function RegisterForm() {
  const [state, action] = useFormState(registerAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="mt-4 space-y-3">
      {state.error && (
        <p className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Field name="name" label="Full name" required errors={fe.name} />
      <Field name="email" label="Email" type="email" required errors={fe.email} />
      <Field
        name="password"
        label="Password (min 12 characters)"
        type="password"
        required
        errors={fe.password}
      />
      <Field
        name="confirmPassword"
        label="Confirm password"
        type="password"
        required
        errors={fe.confirmPassword}
      />
      <Field name="orcid" label="ORCID (optional)" placeholder="0000-0000-0000-0000" errors={fe.orcid} />
      <Field name="affiliation" label="Affiliation (optional)" errors={fe.affiliation} />
      <SubmitButton />
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  errors,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  errors?: string[];
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="input"
      />
      {errors?.map((e) => (
        <p key={e} className="field-hint text-danger">
          {e}
        </p>
      ))}
    </div>
  );
}
