import type { IdentifierStatus } from "@prisma/client";

/**
 * Metadata a provider needs to mint / register an identifier for a record
 * version. Deliberately minimal + provider-agnostic.
 */
export interface IdentifierMintInput {
  recordId: string;
  recordVersionId: string;
  paidValue: string; // "PAID:2026:000001"
  paidNumber: number;
  paidYear: number;
  title: string;
  authors: { fullName: string; givenName?: string | null; familyName?: string | null; orcid?: string | null }[];
  publicationDate: Date;
  resourceUrl: string; // canonical landing page
  publicationType: string;
  language: string;
  license?: { code: string; url?: string | null } | null;
  abstract?: string;
}

export interface IdentifierMintResult {
  /** The identifier string. For local: the PAID. For DOI: "10.xxxxx/...". */
  value: string;
  type: "PAID" | "DOI";
  status: IdentifierStatus;
  provider: string;
  registeredAt?: Date | null;
  providerResponse?: unknown;
}

/**
 * Common interface for every identifier backend.
 *
 * LocalIdentifierProvider is ALWAYS available and issues P/A Identifiers.
 * CrossrefProvider / DataCiteProvider only operate when real credentials +
 * an assigned prefix are present; otherwise `isConfigured()` is false and the
 * registry falls back to local so the publish flow never breaks.
 */
export interface IdentifierProvider {
  readonly name: string; // "local" | "crossref" | "datacite"
  readonly issuesFormalDoi: boolean;

  /** True only when this provider can actually register identifiers. */
  isConfigured(): boolean;

  /**
   * Reserve/mint an identifier. May be called at publish time. Implementations
   * must be safe to retry. Throws only on unexpected errors — expected
   * registration failures should return status FAILED with `lastError`.
   */
  mint(input: IdentifierMintInput): Promise<IdentifierMintResult>;

  /** Optional: re-attempt a previously FAILED / PENDING registration. */
  retry?(input: IdentifierMintInput, existingValue: string): Promise<IdentifierMintResult>;
}
