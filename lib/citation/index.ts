import type { RecordView } from "@/lib/records/types";

export type CitationStyle = "apa" | "chicago" | "mla" | "bibtex" | "ris";

function year(view: RecordView): string {
  const d = view.publicationDate ?? view.publishedAt;
  return d ? String(new Date(d).getUTCFullYear()) : "n.d.";
}

function isoDate(view: RecordView): string {
  const d = view.publicationDate ?? view.publishedAt;
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

/** The string to cite AS the identifier: registered DOI URL, else PAID landing page. */
export function citationIdentifier(view: RecordView): string {
  if (view.registeredDoi) return `https://doi.org/${view.registeredDoi}`;
  return view.canonicalUrl;
}

function apaAuthors(view: RecordView): string {
  const names = view.authors.map((a) => {
    const family = a.familyName || a.fullName.split(" ").slice(-1)[0];
    const given = a.givenName || a.fullName.split(" ").slice(0, -1).join(" ");
    const initials = given
      .split(/\s+/)
      .filter(Boolean)
      .map((g) => `${g[0]}.`)
      .join(" ");
    return initials ? `${family}, ${initials}` : family;
  });
  if (names.length === 0) return view.title;
  if (names.length === 1) return names[0];
  if (names.length <= 20) {
    return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  }
  return `${names.slice(0, 19).join(", ")}, ... ${names[names.length - 1]}`;
}

function mlaAuthors(view: RecordView): string {
  const a = view.authors;
  if (a.length === 0) return "";
  const fmt = (x: (typeof a)[number]) => {
    const family = x.familyName || x.fullName.split(" ").slice(-1)[0];
    const given = x.givenName || x.fullName.split(" ").slice(0, -1).join(" ");
    return given ? `${family}, ${given}` : family;
  };
  if (a.length === 1) return `${fmt(a[0])}.`;
  if (a.length === 2) return `${fmt(a[0])}, and ${a[1].fullName}.`;
  return `${fmt(a[0])}, et al.`;
}

function chicagoAuthors(view: RecordView): string {
  const a = view.authors;
  if (a.length === 0) return "";
  const fmt = (x: (typeof a)[number], first: boolean) => {
    const family = x.familyName || x.fullName.split(" ").slice(-1)[0];
    const given = x.givenName || x.fullName.split(" ").slice(0, -1).join(" ");
    if (!given) return family;
    return first ? `${family}, ${given}` : `${given} ${family}`;
  };
  if (a.length === 1) return `${fmt(a[0], true)}.`;
  if (a.length <= 3) {
    return `${a.map((x, i) => fmt(x, i === 0)).join(", ")}.`;
  }
  return `${fmt(a[0], true)} et al.`;
}

export function formatCitation(view: RecordView, style: CitationStyle): string {
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute";
  const service = process.env.NEXT_PUBLIC_SERVICE_NAME || "P/A Archive";
  const id = citationIdentifier(view);
  const v = view.versionLabel ? ` (Version ${view.versionLabel})` : "";

  switch (style) {
    case "apa":
      return `${apaAuthors(view)} (${year(view)}). ${view.title}${v} [${humanType(view)}]. ${service}, ${operator}. ${id}`;

    case "mla": {
      const auth = mlaAuthors(view);
      return `${auth ? auth + " " : ""}"${view.title}."${v ? ` ${v.trim()}.` : ""} ${service}, ${operator}, ${year(view)}, ${id}.`;
    }

    case "chicago":
      return `${chicagoAuthors(view)} "${view.title}."${v ? ` ${v.trim()}.` : ""} ${service}, ${operator}, ${year(view)}. ${id}.`;

    case "bibtex":
      return toBibtex(view);

    case "ris":
      return toRis(view);
  }
}

function humanType(view: RecordView): string {
  return view.publicationType
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function bibtexKey(view: RecordView): string {
  const first = view.authors[0]?.familyName || view.authors[0]?.fullName || "anon";
  const surname = first.split(/\s+/).slice(-1)[0].replace(/[^A-Za-z0-9]/g, "");
  return `${surname.toLowerCase()}${year(view)}_pa${view.paidNumber}`;
}

const BIBTEX_TYPE: Record<string, string> = {
  JOURNAL_ARTICLE: "article",
  PREPRINT: "misc",
  BOOK: "book",
  BOOK_CHAPTER: "incollection",
  WORKING_PAPER: "techreport",
  RESEARCH_NOTE: "article",
  DATASET: "misc",
  SOFTWARE: "software",
  PEER_REVIEW: "misc",
  REPORT: "techreport",
  THESIS: "phdthesis",
  PRESENTATION: "misc",
  OTHER: "misc",
};

export function toBibtex(view: RecordView): string {
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute";
  const type = BIBTEX_TYPE[view.publicationType] ?? "misc";
  const authors = view.authors
    .map((a) => {
      if (a.familyName && a.givenName) return `${a.familyName}, ${a.givenName}`;
      return a.fullName;
    })
    .join(" and ");
  const lines: string[] = [];
  lines.push(`@${type}{${bibtexKey(view)},`);
  lines.push(`  title        = {${view.title}},`);
  if (authors) lines.push(`  author       = {${authors}},`);
  lines.push(`  year         = {${year(view)}},`);
  lines.push(`  institution  = {${operator}},`);
  lines.push(`  publisher    = {${operator}},`);
  lines.push(`  howpublished = {${process.env.NEXT_PUBLIC_SERVICE_NAME || "P/A Archive"}},`);
  if (view.versionLabel) lines.push(`  version      = {${view.versionLabel}},`);
  if (view.registeredDoi) lines.push(`  doi          = {${view.registeredDoi}},`);
  lines.push(`  note         = {${view.primaryIdentifier.value}},`);
  lines.push(`  url          = {${view.canonicalUrl}},`);
  if (view.keywords.length) lines.push(`  keywords     = {${view.keywords.join(", ")}},`);
  if (view.abstract) lines.push(`  abstract     = {${view.abstract.replace(/[{}]/g, "")}},`);
  lines.push(`}`);
  return lines.join("\n");
}

export function toRis(view: RecordView): string {
  const RIS_TYPE: Record<string, string> = {
    JOURNAL_ARTICLE: "JOUR",
    PREPRINT: "GEN",
    BOOK: "BOOK",
    BOOK_CHAPTER: "CHAP",
    WORKING_PAPER: "RPRT",
    RESEARCH_NOTE: "JOUR",
    DATASET: "DATA",
    SOFTWARE: "COMP",
    PEER_REVIEW: "GEN",
    REPORT: "RPRT",
    THESIS: "THES",
    PRESENTATION: "SLIDE",
    OTHER: "GEN",
  };
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME || "P/A Institute";
  const lines: string[] = [];
  lines.push(`TY  - ${RIS_TYPE[view.publicationType] ?? "GEN"}`);
  lines.push(`TI  - ${view.title}`);
  for (const a of view.authors) {
    const name = a.familyName && a.givenName ? `${a.familyName}, ${a.givenName}` : a.fullName;
    lines.push(`AU  - ${name}`);
  }
  const d = isoDate(view);
  if (d) lines.push(`PY  - ${d.slice(0, 4)}`);
  if (d) lines.push(`DA  - ${d.replace(/-/g, "/")}`);
  if (view.abstract) lines.push(`AB  - ${view.abstract.replace(/\r?\n/g, " ")}`);
  for (const k of view.keywords) lines.push(`KW  - ${k}`);
  lines.push(`PB  - ${operator}`);
  lines.push(`DP  - ${process.env.NEXT_PUBLIC_SERVICE_NAME || "P/A Archive"}`);
  if (view.registeredDoi) lines.push(`DO  - ${view.registeredDoi}`);
  lines.push(`UR  - ${view.canonicalUrl}`);
  lines.push(`ID  - ${view.primaryIdentifier.value}`);
  if (view.language) lines.push(`LA  - ${view.language}`);
  lines.push(`ER  - `);
  return lines.join("\n");
}

export const CITATION_STYLE_LABELS: { value: CitationStyle; label: string }[] = [
  { value: "apa", label: "APA" },
  { value: "chicago", label: "Chicago" },
  { value: "mla", label: "MLA" },
  { value: "bibtex", label: "BibTeX" },
  { value: "ris", label: "RIS" },
];
