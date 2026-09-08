import { LocalIdentifierProvider } from "@/lib/identifiers/local-provider";
import { CrossrefProvider } from "@/lib/identifiers/crossref-provider";
import { DataCiteProvider } from "@/lib/identifiers/datacite-provider";
import type { IdentifierMintInput } from "@/lib/identifiers/types";

const input: IdentifierMintInput = {
  recordId: "r1",
  recordVersionId: "v1",
  paidValue: "PAID:2026:000001",
  paidNumber: 1,
  paidYear: 2026,
  title: "T",
  authors: [{ fullName: "A" }],
  publicationDate: new Date("2026-01-01"),
  resourceUrl: "https://example.org/records/000001",
  publicationType: "RESEARCH_NOTE",
  language: "en",
  license: null,
};

describe("identifier providers", () => {
  it("LocalIdentifierProvider always issues a PAID with LOCAL status", async () => {
    const p = new LocalIdentifierProvider();
    expect(p.isConfigured()).toBe(true);
    expect(p.issuesFormalDoi).toBe(false);
    const res = await p.mint(input);
    expect(res).toMatchObject({ value: "PAID:2026:000001", type: "PAID", status: "LOCAL", provider: "local" });
  });

  it("CrossrefProvider is not configured without credentials", () => {
    const prev = { ...process.env };
    delete process.env.CROSSREF_USERNAME;
    delete process.env.CROSSREF_PASSWORD;
    delete process.env.CROSSREF_PREFIX;
    // env module caches; test the guard directly via a fresh instance
    expect(new CrossrefProvider().isConfigured()).toBe(false);
    process.env = prev;
  });

  it("DataCiteProvider is not configured without credentials", () => {
    expect(new DataCiteProvider().isConfigured()).toBe(false);
  });

  it("getDoiProvider returns null and status reports local-only by default", async () => {
    const mod = await import("@/lib/identifiers");
    expect(mod.getDoiProvider()).toBeNull();
    expect(mod.formalDoiEnabled()).toBe(false);
    const s = mod.identifierProviderStatus();
    expect(s.formalDoiEnabled).toBe(false);
    expect(s.activeProvider).toBe("local");
  });
});
