import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { checkApiRole } from "@/lib/auth/guards";
import {
  RATE_LIMITS,
  apiError,
  apiServerError,
  assertSameOrigin,
  clientIp,
  enforceRateLimit,
  json,
} from "@/lib/api";
import { createAndRunAuditSession, AuditPipelineError } from "@/lib/research-audit/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/audit — multipart/form-data. field: file (+ optional title).
 * Creates a research-audit session and runs the phase-1 pipeline.
 */
export async function POST(req: NextRequest) {
  if (!env.auditEnabled) return apiError("The research-audit layer is disabled.", 404);

  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await checkApiRole("SUBMITTER");
  if (!gate.ok) return apiError(gate.error, gate.status);

  const limited = enforceRateLimit(req, RATE_LIMITS.upload, gate.user.id);
  if (limited) return limited;

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > env.auditMaxDocBytes + 1_000_000) return apiError("Upload too large", 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("multipart/form-data body required", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("Missing 'file' field", 400);

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const res = await createAndRunAuditSession(
      gate.user.id,
      {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        bytes,
        title: (form.get("title") as string) || null,
      },
      clientIp(req),
    );
    return json(
      { ok: true, sessionId: res.sessionId, url: `${env.siteUrl}/audit/${res.sessionId}` },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuditPipelineError) return apiError(err.message, err.status);
    return apiServerError(err, "POST /api/audit");
  }
}
