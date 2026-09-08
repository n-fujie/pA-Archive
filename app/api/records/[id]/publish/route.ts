import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { publishRecord, RecordServiceError } from "@/lib/records/service";
import { getSessionUser, canManageRecord } from "@/lib/auth/guards";
import { apiError, clientIp, json } from "@/lib/api";

export const runtime = "nodejs";

/** POST /api/records/:id/publish — AUTHENTICATED owner/editor. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const num = parseRecordSlug(id);
  if (num === null) return apiError("Invalid record id", 400);

  const user = await getSessionUser();
  if (!user) return apiError("Authentication required", 401);

  const record = await prisma.record.findUnique({
    where: { paidNumber: num },
    select: { id: true, submitterId: true },
  });
  if (!record) return apiError("Record not found", 404);
  if (!canManageRecord(user, record)) return apiError("Insufficient permissions", 403);

  try {
    const result = await publishRecord(record.id, user.id, clientIp(req));
    return json({
      ok: true,
      id: result.slug,
      identifier: result.paid,
      doi: result.doi, // null unless a real DOI registrar is connected
      doiStatus: result.doiStatus,
      warnings: result.warnings,
      landingPage: `${process.env.NEXT_PUBLIC_SITE_URL}/records/${result.slug}`,
    });
  } catch (err) {
    if (err instanceof RecordServiceError) return apiError(err.message, err.status, err.details);
    console.error(err);
    return apiError("Internal error", 500);
  }
}
