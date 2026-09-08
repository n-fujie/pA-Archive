import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { hashIp } from "@/lib/audit";
import { getSessionUser, canManageRecord } from "@/lib/auth/guards";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
  const isPublic =
    file.recordVersion.state === "PUBLISHED" &&
    ["PUBLISHED", "RETRACTED", "WITHDRAWN"].includes(record.status);

  if (!isPublic) {
    const user = await getSessionUser();
    if (!user || !canManageRecord(user, record)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Record the download (published records only), fire-and-forget.
  if (isPublic) {
    prisma.downloadEvent
      .create({
        data: {
          fileId: file.id,
          recordId: record.id,
          ipHash: hashIp(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null),
          userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          referer: req.headers.get("referer")?.slice(0, 300) ?? null,
        },
      })
      .catch(() => undefined);
  }

  // Redirect to a provider-native URL when available (blob / s3+cdn).
  const storage = getStorage();
  const native = file.downloadUrl ?? storage.publicUrl(file.storageKey);
  if (native) {
    return NextResponse.redirect(native, { status: 302 });
  }

  try {
    const obj = await storage.get(file.storageKey);
    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Length": String(obj.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch (err) {
    console.error("[download] storage error", err);
    return NextResponse.json({ error: "File temporarily unavailable" }, { status: 502 });
  }
}
