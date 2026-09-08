import { formatPaid, parseRecordSlug, recordSlug } from "@/lib/identifiers/paid";

describe("PAID formatting", () => {
  it("formats PAID:YYYY:NNNNNN with zero padding", () => {
    expect(formatPaid(2026, 1)).toBe("PAID:2026:000001");
    expect(formatPaid(2026, 123456)).toBe("PAID:2026:123456");
    expect(formatPaid(2030, 42)).toBe("PAID:2030:000042");
  });

  it("produces a 6-digit record slug", () => {
    expect(recordSlug(1)).toBe("000001");
    expect(recordSlug(999999)).toBe("999999");
    expect(recordSlug(1234567)).toBe("1234567");
  });

  it("parses padded and bare slugs, rejects junk", () => {
    expect(parseRecordSlug("000001")).toBe(1);
    expect(parseRecordSlug("42")).toBe(42);
    expect(parseRecordSlug("abc")).toBeNull();
    expect(parseRecordSlug("-1")).toBeNull();
    expect(parseRecordSlug("0")).toBeNull();
    expect(parseRecordSlug("1.5")).toBeNull();
  });
});
