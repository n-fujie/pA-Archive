import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { env } from "@/lib/env";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register", robots: { index: false } };

export default function RegisterPage() {
  if (!env.allowOpenSignup) notFound();
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Register</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Create a submitter account. Reviewer, editor and administrator roles are
        assigned by {env.operatorName} staff.
      </p>
      <RegisterForm />
      <p className="mt-4 text-sm text-ink-muted">
        Already have an account? <Link href="/login">Sign in</Link>.
      </p>
    </div>
  );
}
