import { citationIdentifier, formatCitation } from "@/lib/citation";
import { makeRecordView } from "../fixtures/record-view";

describe("citation formatting", () => {
  it("cites the landing page URL when there is no registered DOI", () => {
    const v = makeRecordView();
    expect(citationIdentifier(v)).toBe("https://archive.platodesignlab.com/records/000001");
    const apa = formatCitation(v, "apa");
    expect(apa).toContain("Lovelace, A.");
    expect(apa).toContain("(2026)");
    expect(apa).toContain("https://archive.platodesignlab.com/records/000001");
    expect(apa).not.toContain("doi.org");
  });

  it("cites the DOI URL when a DOI is genuinely registered", () => {
    const v = makeRecordView({ registeredDoi: "10.12345/pa.2026.000001" });
    expect(citationIdentifier(v)).toBe("https://doi.org/10.12345/pa.2026.000001");
    expect(formatCitation(v, "apa")).toContain("https://doi.org/10.12345/pa.2026.000001");
  });

  it("BibTeX omits the doi field unless a DOI is registered", () => {
    expect(formatCitation(makeRecordView(), "bibtex")).not.toMatch(/^\s*doi\s*=/m);
    const withDoi = formatCitation(makeRecordView({ registeredDoi: "10.1/x" }), "bibtex");
    expect(withDoi).toMatch(/doi\s+=\s+\{10\.1\/x\}/);
    expect(withDoi).toContain("note         = {PAID:2026:000001}");
  });

  it("RIS includes the PAID as ID and only includes DO when registered", () => {
    const ris = formatCitation(makeRecordView(), "ris");
    expect(ris).toContain("ID  - PAID:2026:000001");
    expect(ris).not.toContain("DO  - ");
    expect(ris).toContain("ER  - ");
  });

  it("produces MLA and Chicago strings", () => {
    const v = makeRecordView();
    expect(formatCitation(v, "mla")).toContain("\"A Study of Persistent Identifiers.\"");
    expect(formatCitation(v, "chicago")).toContain("Lovelace, Ada");
  });
});
