import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { SearchResults } from "@/components/search-results";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <div>
      <h1 className="text-xl font-semibold">Search the archive</h1>
      <div className="mt-3 max-w-2xl">
        <SearchBox initial={typeof sp.q === "string" ? sp.q : ""} />
      </div>
      <div className="mt-6">
        <Suspense fallback={<p className="prose-academic">Searching…</p>}>
          <SearchResults rawParams={sp} basePath="/search" />
        </Suspense>
      </div>
    </div>
  );
}
