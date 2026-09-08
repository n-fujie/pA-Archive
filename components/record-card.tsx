import Link from "next/link";
import { CATEGORY_LABEL, PUBLICATION_TYPE_LABEL } from "@/lib/constants";
import type { RecordCardData } from "@/lib/records/browse";

export function RecordCard({ r }: { r: RecordCardData }) {
  return (
    <article className="border-b border-rule py-3 first:pt-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-ink-muted uppercase tracking-wide">
          {PUBLICATION_TYPE_LABEL[r.publicationType as keyof typeof PUBLICATION_TYPE_LABEL] ?? r.publicationType}
        </span>
        <span className="text-ink-faint">·</span>
        <span className="text-ink-muted">{CATEGORY_LABEL[r.category] ?? r.category}</span>
        {r.year && (
          <>
            <span className="text-ink-faint">·</span>
            <span className="text-ink-muted">{r.year}</span>
          </>
        )}
        {r.isPeerReviewed && <span className="badge badge-review">Peer reviewed</span>}
        {r.status === "RETRACTED" && <span className="badge badge-danger">Retracted</span>}
      </div>
      <h3 className="mt-1 text-[15px] font-semibold leading-snug">
        <Link href={`/records/${r.slug}`}>{r.title}</Link>
      </h3>
      {r.authors.length > 0 && (
        <p className="mt-0.5 text-sm text-ink-soft">
          {r.authors.slice(0, 6).join(", ")}
          {r.authors.length > 6 ? ", et al." : ""}
        </p>
      )}
      <p className="mt-1 font-mono text-xs text-ink-muted">
        {r.doi ? (
          <>
            <span className="badge badge-doi">DOI</span> https://doi.org/{r.doi}
          </>
        ) : (
          <>
            <span className="badge badge-paid">P/A ID</span> {r.identifier}
          </>
        )}
      </p>
    </article>
  );
}
