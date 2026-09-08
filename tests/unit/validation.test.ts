import {
  draftMetadataSchema,
  publishMetadataSchema,
  orcidRegex,
  searchQuerySchema,
} from "@/lib/validation/schemas";

describe("validation schemas", () => {
  it("draft schema only requires a title", () => {
    const r = draftMetadataSchema.safeParse({ title: "Hello" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.language).toBe("en");
      expect(r.data.publicationType).toBe("OTHER");
      expect(r.data.authors).toEqual([]);
    }
    expect(draftMetadataSchema.safeParse({}).success).toBe(false);
  });

  it("publish schema additionally requires abstract, author, license, category", () => {
    const base = { title: "T", category: "methodology" };
    expect(publishMetadataSchema.safeParse(base).success).toBe(false);
    const ok = publishMetadataSchema.safeParse({
      ...base,
      abstract: "A sufficiently long abstract for publication.",
      authors: [{ fullName: "Jane Roe" }],
      licenseCode: "CC-BY-4.0",
    });
    expect(ok.success).toBe(true);
  });

  it("normalises an ORCID URL to the bare identifier", () => {
    const r = draftMetadataSchema.safeParse({
      title: "T",
      authors: [{ fullName: "X", orcid: "https://orcid.org/0000-0002-1825-0097" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.authors[0].orcid).toBe("0000-0002-1825-0097");
  });

  it("rejects a malformed ORCID", () => {
    const r = draftMetadataSchema.safeParse({
      title: "T",
      authors: [{ fullName: "X", orcid: "1234" }],
    });
    expect(r.success).toBe(false);
  });

  it("orcidRegex accepts the X checksum form", () => {
    expect(orcidRegex.test("0000-0002-1825-009X")).toBe(true);
    expect(orcidRegex.test("0000-0002-1825-0097")).toBe(true);
    expect(orcidRegex.test("0000-0002-1825-009")).toBe(false);
  });

  it("search query schema coerces page and defaults sort", () => {
    const r = searchQuerySchema.parse({ q: "identifiers", page: "3" });
    expect(r.page).toBe(3);
    expect(r.sort).toBe("newest");
    expect(r.peerReviewed).toBe("");
  });
});
