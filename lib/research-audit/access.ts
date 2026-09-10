import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSessionUser, hasRole } from "@/lib/auth/guards";

/** Page-level guard for the /audit area. */
export async function requireAuditAccess(returnTo?: string) {
  if (!env.auditEnabled) notFound();
  const user = await getSessionUser();
  if (!user) redirect(`/login${returnTo ? `?callbackUrl=${encodeURIComponent(returnTo)}` : ""}`);
  return user;
}

export async function requireOwnedAuditSession(id: string, returnTo: string) {
  const user = await requireAuditAccess(returnTo);
  const s = await prisma.auditSession.findUnique({ where: { id }, select: { uploaderId: true } });
  if (!s) notFound();
  if (s.uploaderId !== user.id && !hasRole(user.role, "EDITOR")) notFound();
  return user;
}
