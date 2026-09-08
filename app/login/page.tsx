import Link from "next/link";
import type { Metadata } from "next";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Access submission, review, and editorial tools.
      </p>
      <LoginForm callbackUrl={sp.callbackUrl} error={sp.error} />
      {env.allowOpenSignup && (
        <p className="mt-4 text-sm text-ink-muted">
          No account? <Link href="/register">Register as a submitter</Link>.
        </p>
      )}
    </div>
  );
}
