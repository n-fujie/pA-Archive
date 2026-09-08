import { NextResponse, type NextRequest } from "next/server";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { loadRecordView } from "@/lib/records/load";
import { metadataInFormat } from "@/lib/metadata";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = parseRecordSlug(id);
  if (num === null) return NextResponse.json({ error: "Invalid record id" }, { status: 400 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const version = url.searchParams.get("version");

  const view = await loadRecordView(num, {
    versionNumber: version ? Number.parseInt(version, 10) : undefined,
  });
  if (!view) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const { body, contentType, filename } = metadataInFormat(view, format);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
