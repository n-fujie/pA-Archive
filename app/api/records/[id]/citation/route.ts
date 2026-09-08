import { NextResponse, type NextRequest } from "next/server";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { loadRecordView } from "@/lib/records/load";
import { formatCitation, type CitationStyle } from "@/lib/citation";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/api";

export const runtime = "nodejs";

const STYLES: CitationStyle[] = ["apa", "chicago", "mla", "bibtex", "ris"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(req, RATE_LIMITS.publicApi);
  if (limited) return limited;

  const { id } = await params;
  const num = parseRecordSlug(id);
  if (num === null) return NextResponse.json({ error: "Invalid record id" }, { status: 400 });

  const url = new URL(req.url);
  const style = (url.searchParams.get("style") ?? "").toLowerCase() as CitationStyle;
  const view = await loadRecordView(num);
  if (!view) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  if (style && STYLES.includes(style)) {
    const text = formatCitation(view, style);
    const ct =
      style === "bibtex"
        ? "application/x-bibtex"
        : style === "ris"
          ? "application/x-research-info-systems"
          : "text/plain";
    return new NextResponse(text, {
      headers: { "Content-Type": `${ct}; charset=utf-8`, "Access-Control-Allow-Origin": "*" },
    });
  }

  return NextResponse.json(
    {
      identifier: view.primaryIdentifier.value,
      doi: view.registeredDoi,
      landingPage: view.canonicalUrl,
      citations: Object.fromEntries(STYLES.map((s) => [s, formatCitation(view, s)])),
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
