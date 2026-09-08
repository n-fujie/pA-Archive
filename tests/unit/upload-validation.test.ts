import { buildStorageKey, extensionOf, validateUpload } from "@/lib/storage";

describe("upload validation", () => {
  it("accepts common research file types", () => {
    expect(validateUpload("paper.pdf", "application/pdf", 1000).ok).toBe(true);
    expect(validateUpload("data.csv", "text/csv", 1000).ok).toBe(true);
    expect(validateUpload("archive.zip", "application/zip", 1000).ok).toBe(true);
    expect(validateUpload("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 1000).ok).toBe(true);
  });

  it("rejects executable / script types even with an innocuous MIME", () => {
    expect(validateUpload("malware.exe", "application/octet-stream", 10).ok).toBe(false);
    expect(validateUpload("run.sh", "text/plain", 10).ok).toBe(false);
    expect(validateUpload("app.js", "text/plain", 10).ok).toBe(false);
    expect(validateUpload("thing.bat", "application/octet-stream", 10).ok).toBe(false);
  });

  it("rejects path traversal and missing extensions", () => {
    expect(validateUpload("../../etc/passwd", "text/plain", 10).ok).toBe(false);
    expect(validateUpload("noext", "text/plain", 10).ok).toBe(false);
  });

  it("enforces the size limit", () => {
    expect(validateUpload("big.pdf", "application/pdf", 999_999_999).ok).toBe(false);
    expect(validateUpload("empty.pdf", "application/pdf", 0).ok).toBe(false);
  });

  it("extensionOf lowercases and strips", () => {
    expect(extensionOf("Report.PDF")).toBe("pdf");
    expect(extensionOf("no-dot")).toBe("");
  });

  it("buildStorageKey is traversal-safe", () => {
    const key = buildStorageKey("rec1", 2, "abc", "../../evil name!.pdf");
    expect(key).toBe("records/rec1/v2/abc-evil_name_.pdf");
    expect(key).not.toContain("..");
  });
});
