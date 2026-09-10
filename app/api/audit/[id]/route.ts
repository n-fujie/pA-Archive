import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSessionUser, hasRole } from "@/lib/auth/guards";
import { apiError, json } from "@/lib/api";
import { loadAuditSession } from "@/lib/research-audit/load";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/audit/:id — full audit session (uploader or editor+ only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!env.auditEnabled) return apiError("Not found", 404);
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return apiError("Not found", 404);

  const user = await getSessionUser();
  if (!user) return apiError("Authentication required", 401);

  const owner = await prisma.auditSession.findUnique({ where: { id }, select: { uploaderId: true } });
  if (!owner) return apiError("Not found", 404);
  if (owner.uploaderId !== user.id && !hasRole(user.role, "EDITOR")) {
    return apiError("Not found", 404);
  }

  const view = await loadAuditSession(id);
  if (!view) return apiError("Not found", 404);
  // Do not ship the full extracted text in the API payload by default.
  const { document, ...rest } = view;
  return json({
    ...rest,
    document: document ? { ...document, text: undefined, textLength: document.text.length } : null,
  });
}
