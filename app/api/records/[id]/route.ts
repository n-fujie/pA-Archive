import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { loadRecordView } from "@/lib/records/load";
import { toMetadataJson } from "@/lib/metadata";
import { updateDraftMetadata, RecordServiceError } from "@/lib/records/service";
import { getSessionUser, canManageRecord } from "@/lib/auth/guards";
import {
  RATE_LIMITS,
  apiError,
  apiServerError,
  assertSameOrigin,
  clientIp,
  enforceRateLimit,
  json,
  jsonPublic,
  readJson,
} from "@/lib/api";

export const runtime = "nodejs";

/** GET /api/records/:id — PUBLIC. Full metadata for a published record. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(req, RATE_LIMITS.publicApi);
  if (limited) return limited;

  const { id } = await params;
  const num = parseRecordSlug(id);
  if (num === null) return apiError("Invalid record id", 400);
  const view = await loadRecordView(num);
  if (!view) return apiError("Record not found", 404);
  return jsonPublic(toMetadataJson(view));
}

/** PATCH /api/records/:id — AUTHENTICATED owner/editor. Updates draft metadata. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const num = parseRecordSlug(id);
  if (num === null) return apiError("Invalid record id", 400);

  const user = await getSessionUser();
  if (!user) return apiError("Authentication required", 401);

  const limited = enforceRateLimit(req, RATE_LIMITS.mutation, user.id);
  if (limited) return limited;

  const record = await prisma.record.findUnique({
    where: { paidNumber: num },
    select: { id: true, submitterId: true },
  });
  if (!record) return apiError("Record not found", 404);
  if (!canManageRecord(user, record)) return apiError("Insufficient permissions", 403);

  const body = await readJson(req);
  if (!body) return apiError("JSON body required", 400);

  try {
    await updateDraftMetadata(record.id, body, user.id, clientIp(req));
    const view = await loadRecordView(num, { includeUnpublished: true });
    return json({ ok: true, record: view ? toMetadataJson(view) : null });
  } catch (err) {
    if (err instanceof RecordServiceError) return apiError(err.message, err.status, err.details);
    return apiServerError(err, "PATCH /api/records/:id");
  }
}
