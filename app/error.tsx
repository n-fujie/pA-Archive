"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates with the server log line; the message itself is not
    // shown to the user.
    console.error("client boundary error", error.digest);
  }, [error]);

  return (
    <div className="max-w-prose">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="prose-academic mt-2">
        An unexpected error occurred while processing your request. The archive
        team can investigate using the reference below.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-faint">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-secondary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary no-underline hover:no-underline">
          Home
        </Link>
      </div>
    </div>
  );
}
