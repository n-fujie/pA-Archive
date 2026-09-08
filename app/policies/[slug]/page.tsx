import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PolicyPage } from "@/components/policy";
import { site } from "@/lib/site";

const POLICIES: Record<string, { title: string; body: string[] }> = {
  publication: {
    title: "Publication Policy",
    body: [
      "Submissions are accepted as drafts and are private until the submitter publishes them. Publication runs metadata validation, confirms at least one file and a license, records the publication timestamp, and issues a persistent identifier.",
      "Every published record receives a P/A Identifier (PAID:YYYY:NNNNNN). A formal DOI is issued only where a Crossref or DataCite agreement is connected; otherwise no value is presented as a DOI.",
      "The record identity (concept) is stable. New versions are added without overwriting earlier files or metadata.",
      "Accepted publication types: journal article, preprint, book, book chapter, working paper, research note, dataset, software, peer review, report, thesis, presentation, and other.",
    ],
  },
  "peer-review": {
    title: "Peer Review Policy",
    body: [
      "Peer review is coordinated by editors, who assign reviewers to a record. Review status moves through: not reviewed, under review, revision requested, accepted, rejected, published.",
      "A record displays a “Peer reviewed” badge only when an editor has set its status to Accepted or Published. Unreviewed records are labelled as such.",
      "With reviewer consent, a review may be published as an independent, citable record linked to the reviewed work.",
      "Confidential comments to the editor are never published.",
    ],
  },
  "research-integrity": {
    title: "Research Integrity Policy",
    body: [
      "Allegations of misconduct — fabrication, falsification, plagiarism, undisclosed conflicts, or authorship disputes — are investigated by the editorial office.",
      "Outcomes may include a correction, an expression of concern, retraction, or withdrawal. Every outcome is recorded permanently and visibly on the record.",
      "The scholarly record is not erased. Corrections and retractions are additive.",
    ],
  },
  retraction: {
    title: "Retraction Policy",
    body: [
      "A retraction is issued when the findings are demonstrably unreliable, whether through error or misconduct.",
      "A retracted record remains online with its files intact, clearly marked as retracted, together with the reason and the date.",
      "A withdrawal removes a record from public listings but preserves a tombstone page with its identifier and the reason.",
      "Corrections do not remove a record; the record stays published with the correction notice attached.",
    ],
  },
  copyright: {
    title: "Copyright and Licensing",
    body: [
      "Authors retain copyright in their work. On deposit, authors choose a license that governs reuse (for example CC BY 4.0, CC0 1.0, or all rights reserved).",
      "A license must be selected before a record can be published. The selected license is shown on the record and embedded in its machine-readable metadata.",
      "P/A Institute claims no ownership of deposited content and asserts no DOI registration authority in the absence of a registrar agreement.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = POLICIES[slug];
  return { title: p ? p.title : "Policy" };
}

export default async function PolicyRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();
  return (
    <PolicyPage title={policy.title}>
      {policy.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <p className="text-xs text-ink-faint">
        This is provisional wording for {site.operator} and will be superseded by
        the formally adopted policy.
      </p>
    </PolicyPage>
  );
}
