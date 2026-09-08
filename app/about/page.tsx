import type { Metadata } from "next";
import { PolicyPage } from "@/components/policy";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <PolicyPage title={`About ${site.name}`}>
      <p>
        {site.name} is the independent research repository of {site.operator}. It
        accepts scholarly works across disciplines, generates a public landing
        page for each, and assigns a persistent identifier.
      </p>
      <p>
        Every record receives a <strong>P/A Identifier</strong> of the form{" "}
        <span className="font-mono">PAID:YYYY:NNNNNN</span>, resolvable at{" "}
        <span className="font-mono">{site.url}/records/NNNNNN</span>. P/A
        Identifiers are permanent and citable. They are <em>not</em> DOIs.
      </p>
      <p>
        When {site.operator} establishes a membership with a DOI registration
        agency (Crossref or DataCite), records will additionally be assigned a
        formal DOI. Until then, no value is presented as a registered DOI.
      </p>
      <p>
        The archive is built to connect, over time, to ORCID authentication, ROR,
        OpenAlex, OAI-PMH harvesting, JATS XML, and preservation networks.
      </p>
    </PolicyPage>
  );
}
