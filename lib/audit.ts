import { createHash } from "node:crypto";
import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/log";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  action: AuditAction;
  actorId?: string | null;
  targetType: string;
  targetId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** One-way hash of an IP for audit / analytics without storing PII. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? "pa-archive";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function writeAudit(input: AuditInput, db: Db = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        summary: input.summary,
        metadata: input.metadata,
        ipHash: hashIp(input.ip ?? null),
      },
    });
  } catch (err) {
    // Never let audit failure break the primary operation; log and continue.
    logger.error("audit.write_failed", err, { action: input.action, targetType: input.targetType });
  }
}
