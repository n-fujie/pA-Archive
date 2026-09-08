import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Not authorized", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div className="max-w-prose">
      <h1 className="text-xl font-semibold">Not authorized</h1>
      <p className="prose-academic mt-2">
        Your account does not have permission to view this page. If you believe
        this is an error, contact an editor or administrator.
      </p>
      <p className="mt-4">
        <Link href="/">Return to the archive</Link>
      </p>
    </div>
  );
}
