import type {
  IdentifierMintInput,
  IdentifierMintResult,
  IdentifierProvider,
} from "./types";

/**
 * LocalIdentifierProvider — the always-on backend.
 *
 * Issues P/A Identifiers (PAID:YYYY:NNNNNN). It does NOT create DOIs and it
 * never claims DOI registration. The PAID number itself is allocated
 * transactionally upstream (see paid.ts); this provider only records that the
 * identifier is live.
 */
export class LocalIdentifierProvider implements IdentifierProvider {
  readonly name = "local";
  readonly issuesFormalDoi = false;

  isConfigured(): boolean {
    return true;
  }

  async mint(input: IdentifierMintInput): Promise<IdentifierMintResult> {
    return {
      value: input.paidValue,
      type: "PAID",
      status: "LOCAL",
      provider: "local",
      registeredAt: new Date(),
      providerResponse: { note: "P/A Identifier issued locally; no external registry." },
    };
  }
}
