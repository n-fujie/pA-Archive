import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ROLE_LEVEL } from "@/lib/constants";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

/** Pure role-hierarchy check. Safe to unit test. */
export function hasRole(userRole: Role | undefined | null, required: Role): boolean {
  if (!userRole) return false;
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[required];
}

/** Returns the current session user or null (no redirect). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    role: (session.user.role as Role) ?? "SUBMITTER",
  };
}

/** Server-component guard: redirect to /login if unauthenticated. */
export async function requireAuth(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login${returnTo ? `?callbackUrl=${encodeURIComponent(returnTo)}` : ""}`);
  }
  return user;
}

/** Server-component guard: redirect to /login or /403 if role too low. */
export async function requireRole(required: Role, returnTo?: string): Promise<SessionUser> {
  const user = await requireAuth(returnTo);
  if (!hasRole(user.role, required)) {
    redirect("/403");
  }
  return user;
}

/**
 * API-route guard. Returns { user } on success or { error, status } to return.
 * Never trusts a client-supplied role — always reads the session.
 */
export async function checkApiRole(
  required: Role,
): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; status: number; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, error: "Authentication required" };
  if (!hasRole(user.role, required)) {
    return { ok: false, status: 403, error: "Insufficient permissions" };
  }
  return { ok: true, user };
}

/** Fetch the freshest role from the DB (session may be stale after a change). */
export async function getFreshRole(userId: string): Promise<Role | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, disabled: true },
  });
  if (!u || u.disabled) return null;
  return u.role;
}

/**
 * Can this user act on this record? Owner (submitter), editors and admins can.
 */
export function canManageRecord(
  user: SessionUser,
  record: { submitterId: string },
): boolean {
  if (hasRole(user.role, "EDITOR")) return true;
  return record.submitterId === user.id;
}
