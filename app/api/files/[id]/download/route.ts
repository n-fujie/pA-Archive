import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { hashIp } from "@/lib/audit";
import { getSessionUser, canManageRecord } from "@/lib/auth/guards";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/api";
import { logger } from "@/lib/log";

export const runtime = "nodejs";

// Content types that must never be served so a browser renders them inline.
const NEUTRALISE = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
]);

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(req, RATE_LIMITS.publicApi);
  if (limited) return limited;

  const { id } = await params;
  // Accept a cuid or a UUID; reject anything else before touching the DB.
  if (!/^[a-z0-9-]{20,40}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const file = await prisma.fileObject.findUnique({
    where: { id },
    include: {
      recordVersion: {
        include: { record: { select: { id: true, status: true, submitterId: true } } },
      },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const record = file.recordVersion.record;
  // Public: a published version of a record that is still on the public record
  // (PUBLISHED or RETRACTED — retracted works stay citable). WITHDRAWN and
  // DRAFT files are owner/staff-only.
  const isPublic =
    file.recordVersion.state === "PUBLISHED" &&
    (record.status === "PUBLISHED" || record.status === "RETRACTED");

  if (!isPublic) {
    const user = await getSessionUser();
    if (!user || !canManageRecord(user, record)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (isPublic) {
    const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    prisma.downloadEvent
      .create({
        data: {
          fileId: file.id,
          recordId: record.id,
          ipHash: hashIp(xff),
          userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          referer: req.headers.get("referer")?.slice(0, 300) ?? null,
        },
      })
      .catch(() => undefined);
  }

  const storage = getStorage();
  const native = file.downloadUrl ?? storage.publicUrl(file.storageKey);
  if (native) {
    // Provider-native URL (blob / s3+cdn). Still a download, on that origin.
    return NextResponse.redirect(native, { status: 302 });
  }

  try {
    const obj = await storage.get(file.storageKey);
    const safeType = NEUTRALISE.has((file.contentType || "").toLowerCase())
      ? "application/octet-stream"
      : file.contentType || "application/octet-stream";
    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type": safeType,
        "Content-Length": String(obj.size),
        "Content-Disposition": contentDisposition(file.originalName),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch (err) {
    logger.error("download.storage_error", err, { fileId: file.id });
    return NextResponse.json({ error: "File temporarily unavailable" }, { status: 502 });
  }
}
