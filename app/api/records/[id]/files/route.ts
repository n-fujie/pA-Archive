import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { getSessionUser, canManageRecord } from "@/lib/auth/guards";
import {
  addFileToRecord,
  deleteFileFromDraft,
  replaceFile,
} from "@/lib/records/files";
import { RecordServiceError } from "@/lib/records/service";
import {
  RATE_LIMITS,
  apiError,
  apiServerError,
  assertSameOrigin,
  clientIp,
  enforceRateLimit,
  json,
} from "@/lib/api";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authorize(num: number) {
  const user = await getSessionUser();
  if (!user) return { error: apiError("Authentication required", 401) };
  const record = await prisma.record.findUnique({
    where: { paidNumber: num },
    select: { id: true, submitterId: true },
  });
  if (!record) return { error: apiError("Record not found", 404) };
  if (!canManageRecord(user, record)) return { error: apiError("Insufficient permissions", 403) };
  return { user, record };
}

/** POST /api/records/:id/files — multipart/form-data. field: file (+ optional label, isPrimary, replaces) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const num = parseRecordSlug(id);
  if (num === null) return apiError("Invalid record id", 400);

  const gate = await authorize(num);
  if ("error" in gate) return gate.error;

  const limited = enforceRateLimit(req, RATE_LIMITS.upload, gate.user.id);
  if (limited) return limited;

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > env.maxUploadBytes + 1_000_000) {
    return apiError("Upload too large", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("multipart/form-data body required", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("Missing 'file' field", 400);

  const bytes = Buffer.from(await file.arrayBuffer());
  const payload = {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    bytes,
    label: (form.get("label") as string) || null,
    isPrimary: form.get("isPrimary") === "true",
  };
  const replaces = form.get("replaces") as string | null;

  try {
    const res = replaces
      ? await replaceFile(gate.record.id, replaces, payload, gate.user.id, clientIp(req))
      : await addFileToRecord(gate.record.id, payload, gate.user.id, clientIp(req));
    return json({ ok: true, fileId: res.fileId }, { status: 201 });
  } catch (err) {
    if (err instanceof RecordServiceError) return apiError(err.message, err.status, err.details);
    return apiServerError(err, "POST /api/records/:id/files");
  }
}

/** DELETE /api/records/:id/files?fileId=... — remove a file from a draft version. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const num = parseRecordSlug(id);
  if (num === null) return apiError("Invalid record id", 400);

  const gate = await authorize(num);
  if ("error" in gate) return gate.error;

  const limited = enforceRateLimit(req, RATE_LIMITS.mutation, gate.user.id);
  if (limited) return limited;

  const fileId = new URL(req.url).searchParams.get("fileId");
  if (!fileId) return apiError("fileId query param required", 400);

  try {
    await deleteFileFromDraft(gate.record.id, fileId, gate.user.id, clientIp(req));
    return json({ ok: true });
  } catch (err) {
    if (err instanceof RecordServiceError) return apiError(err.message, err.status, err.details);
    return apiServerError(err, "DELETE /api/records/:id/files");
  }
}
