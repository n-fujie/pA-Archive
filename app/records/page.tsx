import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResults } from "@/components/search-results";

export const metadata: Metadata = { title: "Browse records" };
export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <div>
      <h1 className="text-xl font-semibold">Records</h1>
      <p className="mt-1 text-sm text-ink-muted">
        All public records in the archive. Use the filters or the{" "}
        <a href="/search">search page</a> to narrow results.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="prose-academic">Loading…</p>}>
          <SearchResults rawParams={sp} basePath="/records" />
        </Suspense>
      </div>
    </div>
  );
}
