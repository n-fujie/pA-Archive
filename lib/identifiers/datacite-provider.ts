import { env } from "@/lib/env";
import type {
  IdentifierMintInput,
  IdentifierMintResult,
  IdentifierProvider,
} from "./types";

/**
 * DataCiteProvider — registers DOIs via the DataCite REST API (/dois).
 *
 * Inactive until DATACITE_USERNAME / DATACITE_PASSWORD / DATACITE_PREFIX are
 * all set. While inactive, isConfigured() is false and the registry uses the
 * LocalIdentifierProvider instead — no DOI is ever shown.
 *
 * This implementation is intentionally conservative: a failed HTTP call returns
 * status FAILED (with the error captured) rather than throwing, so the publish
 * pipeline is never broken by a registry outage.
 */
export class DataCiteProvider implements IdentifierProvider {
  readonly name = "datacite";
  readonly issuesFormalDoi = true;

  isConfigured(): boolean {
    return Boolean(
      env.datacite.username && env.datacite.password && env.datacite.prefix,
    );
  }

  private doiFor(input: IdentifierMintInput): string {
    const ns = env.doiSuffixNamespace || "pa";
    const suffix = `${ns}.${input.paidYear}.${String(input.paidNumber).padStart(6, "0")}`;
    return `${env.datacite.prefix}/${suffix}`;
  }

  private authHeader(): string {
    const raw = `${env.datacite.username}:${env.datacite.password}`;
    return `Basic ${Buffer.from(raw).toString("base64")}`;
  }

  async mint(input: IdentifierMintInput): Promise<IdentifierMintResult> {
    if (!this.isConfigured()) {
      throw new Error("DataCiteProvider.mint called while not configured");
    }
    const doi = this.doiFor(input);
    const payload = {
      data: {
        type: "dois",
        attributes: {
          doi,
          event: "publish",
          url: input.resourceUrl,
          titles: [{ title: input.title }],
          publisher: env.operatorName,
          publicationYear: input.publicationDate.getUTCFullYear(),
          types: { resourceTypeGeneral: mapResourceType(input.publicationType) },
          creators: input.authors.map((a) => ({
            name: a.fullName,
            givenName: a.givenName ?? undefined,
            familyName: a.familyName ?? undefined,
            nameIdentifiers: a.orcid
              ? [
                  {
                    nameIdentifier: `https://orcid.org/${a.orcid}`,
                    nameIdentifierScheme: "ORCID",
                  },
                ]
              : undefined,
          })),
          descriptions: input.abstract
            ? [{ description: input.abstract, descriptionType: "Abstract" }]
            : undefined,
          rightsList: input.license?.url
            ? [{ rights: input.license.code, rightsUri: input.license.url }]
            : undefined,
        },
      },
    };

    try {
      const res = await fetch(`${env.datacite.apiUrl}/dois`, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.api+json",
          Authorization: this.authHeader(),
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          value: doi,
          type: "DOI",
          status: "FAILED",
          provider: "datacite",
          providerResponse: { httpStatus: res.status, body },
        };
      }
      return {
        value: doi,
        type: "DOI",
        status: "REGISTERED",
        provider: "datacite",
        registeredAt: new Date(),
        providerResponse: body,
      };
    } catch (err) {
      return {
        value: doi,
        type: "DOI",
        status: "FAILED",
        provider: "datacite",
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

function mapResourceType(t: string): string {
  switch (t) {
    case "DATASET":
      return "Dataset";
    case "SOFTWARE":
      return "Software";
    case "JOURNAL_ARTICLE":
    case "PREPRINT":
    case "RESEARCH_NOTE":
    case "WORKING_PAPER":
      return "Text";
    case "PRESENTATION":
      return "Text";
    default:
      return "Text";
  }
}
