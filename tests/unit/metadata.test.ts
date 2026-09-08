import { toDublinCore, toJsonLd, toMetadataJson, metadataInFormat } from "@/lib/metadata";
import { makeRecordView } from "../fixtures/record-view";

describe("machine-readable metadata", () => {
  it("JSON-LD never contains a DOI when none is registered", () => {
    const doc = toJsonLd(makeRecordView());
    expect(doc["@type"]).toBe("ScholarlyArticle");
    expect(JSON.stringify(doc)).not.toContain("doi.org");
    expect(doc["doi"]).toBeUndefined();
    const identifiers = doc.identifier as { propertyID: string }[];
    expect(identifiers.some((i) => i.propertyID === "PAID")).toBe(true);
    expect(identifiers.some((i) => i.propertyID === "DOI")).toBe(false);
  });

  it("JSON-LD includes the DOI once it is registered", () => {
    const doc = toJsonLd(makeRecordView({ registeredDoi: "10.12345/pa.2026.000001" }));
    expect(doc["doi"]).toBe("10.12345/pa.2026.000001");
    expect((doc.sameAs as string[]).some((s) => s.includes("doi.org/10.12345"))).toBe(true);
  });

  it("metadata JSON exposes doi:null when not registered", () => {
    const json = toMetadataJson(makeRecordView()) as { identifier: { doi: unknown; paid: string } };
    expect(json.identifier.doi).toBeNull();
    expect(json.identifier.paid).toBe("PAID:2026:000001");
  });

  it("Dublin Core carries the PAID and landing page", () => {
    const dc = toDublinCore(makeRecordView());
    expect(dc["dc.identifier"]).toContain("PAID:2026:000001");
    expect(dc["dc.identifier"]).toContain("https://archive.platodesignlab.com/records/000001");
  });

  it("format router returns the right content type", () => {
    expect(metadataInFormat(makeRecordView(), "bibtex").contentType).toBe("application/x-bibtex");
    expect(metadataInFormat(makeRecordView(), "json-ld").contentType).toBe("application/ld+json");
    expect(metadataInFormat(makeRecordView(), "dublin-core").contentType).toBe("application/xml");
  });

  it("peer review block appears only when isPeerReviewed", () => {
    expect(toJsonLd(makeRecordView()).review).toBeUndefined();
    expect(toJsonLd(makeRecordView({ isPeerReviewed: true })).review).toBeDefined();
  });
});
