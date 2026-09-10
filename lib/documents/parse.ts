import { segmentText, type Segment } from "./segment";

export interface ParsedDocument {
  text: string;
  segments: Segment[];
  meta: {
    parserName: string;
    parserVersion: string;
    pageCount?: number;
    wordCount: number;
    contentType: string;
  };
}

const SUPPORTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "application/octet-stream", // fall back to extension
]);

export function isParseable(contentType: string, filename: string): boolean {
  const ct = (contentType || "").toLowerCase();
  if (SUPPORTED.has(ct)) return true;
  return /\.(pdf|docx|md|markdown|txt|text)$/i.test(filename);
}

function resolveKind(contentType: string, filename: string): "pdf" | "docx" | "md" | "txt" {
  const ct = (contentType || "").toLowerCase();
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  if (ct.includes("pdf") || ext === "pdf") return "pdf";
  if (ct.includes("wordprocessingml") || ext === "docx") return "docx";
  if (ct.includes("markdown") || ext === "md" || ext === "markdown") return "md";
  return "txt";
}

function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: Array.isArray(text) ? text.join("\n\n") : text, pageCount: totalPages };
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return res.value;
}

/**
 * Parse an uploaded research document into normalised text + identified
 * structural segments. Missing structure is not invented — a document with no
 * abstract yields no ABSTRACT segment.
 */
export async function parseDocument(
  bytes: Uint8Array,
  contentType: string,
  filename: string,
): Promise<ParsedDocument> {
  const kind = resolveKind(contentType, filename);
  let text = "";
  let pageCount: number | undefined;
  let parserName = "text";

  if (kind === "pdf") {
    const r = await extractPdf(bytes);
    text = r.text;
    pageCount = r.pageCount;
    parserName = "unpdf";
  } else if (kind === "docx") {
    text = await extractDocx(bytes);
    parserName = "mammoth";
  } else {
    text = Buffer.from(bytes).toString("utf8");
    parserName = kind === "md" ? "markdown-text" : "plain-text";
  }

  text = normalise(text);
  const segments = segmentText(text, kind);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    text,
    segments,
    meta: { parserName, parserVersion: "1", pageCount, wordCount, contentType },
  };
}
