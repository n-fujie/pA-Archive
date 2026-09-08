import { env } from "@/lib/env";
import type {
  IdentifierMintInput,
  IdentifierMintResult,
  IdentifierProvider,
} from "./types";

/**
 * CrossrefProvider — deposits DOIs via Crossref's deposit API (XML upload).
 *
 * Inactive until CROSSREF_USERNAME / CROSSREF_PASSWORD / CROSSREF_PREFIX are
 * all set. While inactive, isConfigured() is false and no DOI is shown.
 *
 * Crossref deposits are ASYNCHRONOUS: a successful POST only means "queued".
 * We therefore return status PENDING on a successful submit; a later
 * reconciliation job (not included in the MVP) would poll the submission log
 * and flip PENDING -> REGISTERED / FAILED.
 */
export class CrossrefProvider implements IdentifierProvider {
  readonly name = "crossref";
  readonly issuesFormalDoi = true;

  isConfigured(): boolean {
    return Boolean(
      env.crossref.username && env.crossref.password && env.crossref.prefix,
    );
  }

  private doiFor(input: IdentifierMintInput): string {
    const ns = env.doiSuffixNamespace || "pa";
    const suffix = `${ns}.${input.paidYear}.${String(input.paidNumber).padStart(6, "0")}`;
    return `${env.crossref.prefix}/${suffix}`;
  }

  private buildDepositXml(input: IdentifierMintInput, doi: string): string {
    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
      now.getUTCDate(),
    )}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
    const contributors = input.authors
      .map(
        (a, i) => `        <person_name sequence="${i === 0 ? "first" : "additional"}" contributor_role="author">
          <given_name>${esc(a.givenName ?? "")}</given_name>
          <surname>${esc(a.familyName ?? a.fullName)}</surname>
          ${a.orcid ? `<ORCID>https://orcid.org/${esc(a.orcid)}</ORCID>` : ""}
        </person_name>`,
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<doi_batch version="4.4.2" xmlns="http://www.crossref.org/schema/4.4.2">
  <head>
    <doi_batch_id>pa-${input.paidNumber}-${timestamp}</doi_batch_id>
    <timestamp>${timestamp}</timestamp>
    <depositor>
      <depositor_name>${esc(env.crossref.depositorName)}</depositor_name>
      <email_address>${esc(env.crossref.depositorEmail)}</email_address>
    </depositor>
    <registrant>${esc(env.operatorName)}</registrant>
  </head>
  <body>
    <posted_content type="other">
      <contributors>
${contributors}
      </contributors>
      <titles><title>${esc(input.title)}</title></titles>
      <posted_date>
        <month>${pad(input.publicationDate.getUTCMonth() + 1)}</month>
        <day>${pad(input.publicationDate.getUTCDate())}</day>
        <year>${input.publicationDate.getUTCFullYear()}</year>
      </posted_date>
      ${input.abstract ? `<jats:abstract xmlns:jats="http://www.ncbi.nlm.nih.gov/JATS1"><jats:p>${esc(input.abstract)}</jats:p></jats:abstract>` : ""}
      <doi_data>
        <doi>${esc(doi)}</doi>
        <resource>${esc(input.resourceUrl)}</resource>
      </doi_data>
    </posted_content>
  </body>
</doi_batch>`;
  }

  async mint(input: IdentifierMintInput): Promise<IdentifierMintResult> {
    if (!this.isConfigured()) {
      throw new Error("CrossrefProvider.mint called while not configured");
    }
    const doi = this.doiFor(input);
    const xml = this.buildDepositXml(input, doi);

    try {
      const form = new FormData();
      form.append("operation", "doMDUpload");
      form.append("login_id", env.crossref.username);
      form.append("login_passwd", env.crossref.password);
      form.append(
        "fname",
        new Blob([xml], { type: "application/xml" }),
        `pa-${input.paidNumber}.xml`,
      );

      const res = await fetch(env.crossref.depositUrl, {
        method: "POST",
        body: form,
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          value: doi,
          type: "DOI",
          status: "FAILED",
          provider: "crossref",
          providerResponse: { httpStatus: res.status, body: text.slice(0, 2000) },
        };
      }
      // Accepted for asynchronous processing.
      return {
        value: doi,
        type: "DOI",
        status: "PENDING",
        provider: "crossref",
        providerResponse: { body: text.slice(0, 2000) },
      };
    } catch (err) {
      return {
        value: doi,
        type: "DOI",
        status: "FAILED",
        provider: "crossref",
        providerResponse: { error: (err as Error).message },
      };
    }
  }

  async retry(
    input: IdentifierMintInput,
    _existingValue: string,
  ): Promise<IdentifierMintResult> {
    return this.mint(input);
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
