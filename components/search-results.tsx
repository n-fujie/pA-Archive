import Link from "next/link";
import { searchRecords } from "@/lib/records/search";
import { searchQuerySchema } from "@/lib/validation/schemas";
import {
  CATEGORY_LABEL,
  LANGUAGES,
  PUBLICATION_TYPES,
  PUBLICATION_TYPE_LABEL,
} from "@/lib/constants";

type RawParams = Record<string, string | string[] | undefined>;

function toQueryString(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function SearchResults({
  rawParams,
  basePath = "/search",
}: {
  rawParams: RawParams;
  basePath?: string;
}) {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof v === "string") flat[k] = v;
    else if (Array.isArray(v) && v[0]) flat[k] = v[0];
  }
  const parsed = searchQuerySchema.parse(flat);
  const result = await searchRecords(parsed);

  const current = {
    q: parsed.q,
    year: parsed.year,
    type: parsed.type,
    language: parsed.language,
    category: parsed.category,
    peerReviewed: parsed.peerReviewed,
    author: parsed.author,
    keyword: parsed.keyword,
    sort: parsed.sort,
  };

  const filterLink = (patch: Record<string, string | number | undefined>) =>
    `${basePath}${toQueryString({ ...current, ...patch, page: undefined })}`;

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-5 text-sm">
        <FilterGroup title="Sort">
          {(["newest", "oldest"] as const).map((s) => (
            <Link
              key={s}
              href={filterLink({ sort: s })}
              className={parsed.sort === s ? "font-semibold" : ""}
            >
              {s === "newest" ? "Newest first" : "Oldest first"}
            </Link>
          ))}
        </FilterGroup>

        <FilterGroup title="Peer review">
          <Link href={filterLink({ peerReviewed: "" })} className={!parsed.peerReviewed ? "font-semibold" : ""}>
            Any
          </Link>
          <Link href={filterLink({ peerReviewed: "true" })} className={parsed.peerReviewed === "true" ? "font-semibold" : ""}>
            Peer reviewed only
          </Link>
          <Link href={filterLink({ peerReviewed: "false" })} className={parsed.peerReviewed === "false" ? "font-semibold" : ""}>
            Not peer reviewed
          </Link>
        </FilterGroup>

        {result.facets.years.length > 0 && (
          <FilterGroup title="Year">
            <Link href={filterLink({ year: "" })} className={!parsed.year ? "font-semibold" : ""}>
              Any year
            </Link>
            {result.facets.years.slice(0, 12).map((y) => (
              <Link
                key={y.value}
                href={filterLink({ year: y.value })}
                className={parsed.year === String(y.value) ? "font-semibold" : ""}
              >
                {y.value} <span className="text-ink-faint">({y.count})</span>
              </Link>
            ))}
          </FilterGroup>
        )}

        <FilterGroup title="Type">
          <Link href={filterLink({ type: "" })} className={!parsed.type ? "font-semibold" : ""}>
            Any type
          </Link>
          {PUBLICATION_TYPES.map((t) => (
            <Link
              key={t.value}
              href={filterLink({ type: t.value })}
              className={parsed.type === t.value ? "font-semibold" : ""}
            >
              {t.label}
            </Link>
          ))}
        </FilterGroup>

        <FilterGroup title="Language">
          <Link href={filterLink({ language: "" })} className={!parsed.language ? "font-semibold" : ""}>
            Any language
          </Link>
          {LANGUAGES.map((l) => (
            <Link
              key={l.code}
              href={filterLink({ language: l.code })}
              className={parsed.language === l.code ? "font-semibold" : ""}
            >
              {l.label}
            </Link>
          ))}
        </FilterGroup>

        {result.facets.categories.length > 0 && (
          <FilterGroup title="Category">
            <Link href={filterLink({ category: "" })} className={!parsed.category ? "font-semibold" : ""}>
              Any category
            </Link>
            {result.facets.categories.map((c) => (
              <Link
                key={c.value}
                href={filterLink({ category: c.value })}
                className={parsed.category === c.value ? "font-semibold" : ""}
              >
                {CATEGORY_LABEL[c.value] ?? c.value} <span className="text-ink-faint">({c.count})</span>
              </Link>
            ))}
          </FilterGroup>
        )}
      </aside>

      <div>
        <p className="text-sm text-ink-muted">
          {result.total} {result.total === 1 ? "record" : "records"}
          {parsed.q && (
            <>
              {" "}
              matching <span className="font-semibold text-ink">“{parsed.q}”</span>
            </>
          )}
          {(parsed.author || parsed.keyword) && (
            <>
              {" "}· filtered by {parsed.author && `author “${parsed.author}”`}
              {parsed.author && parsed.keyword && ", "}
              {parsed.keyword && `keyword “${parsed.keyword}”`}
            </>
          )}
        </p>

        <div className="mt-3 divide-y divide-rule border-t border-rule">
          {result.hits.length === 0 ? (
            <p className="prose-academic py-6">No records found. Try broadening your filters.</p>
          ) : (
            result.hits.map((h) => (
              <article key={h.slug} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="uppercase tracking-wide text-ink-muted">
                    {PUBLICATION_TYPE_LABEL[h.publicationType as keyof typeof PUBLICATION_TYPE_LABEL] ?? h.publicationType}
                  </span>
                  {h.year && <span className="text-ink-muted">· {h.year}</span>}
                  <span className="text-ink-muted">· {CATEGORY_LABEL[h.category] ?? h.category}</span>
                  {h.isPeerReviewed && <span className="badge badge-review">Peer reviewed</span>}
                  {h.status === "RETRACTED" && <span className="badge badge-danger">Retracted</span>}
                </div>
                <h3 className="mt-1 text-[15px] font-semibold leading-snug">
                  <Link href={`/records/${h.slug}`}>{h.title}</Link>
                </h3>
                {h.authors.length > 0 && (
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {h.authors.slice(0, 8).join(", ")}
                    {h.authors.length > 8 ? ", et al." : ""}
                  </p>
                )}
                {h.abstractSnippet && (
                  <p className="mt-1 text-sm text-ink-muted">{h.abstractSnippet}</p>
                )}
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {h.doi ? `https://doi.org/${h.doi}` : h.identifier}
                </p>
              </article>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <nav className="mt-4 flex items-center gap-2 text-sm">
            {parsed.page > 1 && (
              <Link href={`${basePath}${toQueryString({ ...current, page: parsed.page - 1 })}`}>
                ← Previous
              </Link>
            )}
            <span className="text-ink-muted">
              Page {parsed.page} of {totalPages}
            </span>
            {parsed.page < totalPages && (
              <Link href={`${basePath}${toQueryString({ ...current, page: parsed.page + 1 })}`}>
                Next →
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</div>
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
