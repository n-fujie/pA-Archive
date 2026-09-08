"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({
  autoFocus = false,
  initial = "",
  size = "md",
}: {
  autoFocus?: boolean;
  initial?: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex w-full gap-2"
    >
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search titles, authors, abstracts, keywords, P/A Identifier, DOI, ORCID"
        aria-label="Search the archive"
        className={`input ${size === "lg" ? "!py-2.5 !text-[15px]" : ""}`}
      />
      <button type="submit" className="btn btn-primary whitespace-nowrap">
        Search
      </button>
    </form>
  );
}
