import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Format a PAID string from its parts: PAID:YYYY:NNNNNN (6-digit, zero-padded). */
export function formatPaid(year: number, num: number): string {
  return `PAID:${year}:${String(num).padStart(6, "0")}`;
}

/** Zero-padded record slug used in URLs, e.g. /records/000001. */
export function recordSlug(num: number): string {
  return String(num).padStart(6, "0");
}

/** Parse a /records/:slug value back to an integer (accepts padded or bare). */
export function parseRecordSlug(slug: string): number | null {
  if (!/^\d{1,12}$/.test(slug)) return null;
  const n = Number.parseInt(slug, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Allocate a fresh, globally-unique PAID number for a record.
 *
 * Uniqueness + non-reuse guarantee: each allocation INSERTs a row into
 * `paid_allocations` whose autoincrement primary key IS the number. Rows are
 * never deleted, so a number is never handed out twice — even if the owning
 * record is later removed. Runs inside the caller's transaction.
 */
export async function allocatePaidNumber(
  db: Db,
  recordId: string,
  year: number,
): Promise<number> {
  const row = await db.paidAllocation.create({
    data: { recordId, year },
    select: { number: true },
  });
  return row.number;
}

/**
 * Convenience wrapper that runs its own transaction when the caller does not
 * already have one.
 */
export async function allocatePaid(
  recordId: string,
  year: number,
): Promise<{ number: number; value: string }> {
  const number = await prisma.$transaction((tx) =>
    allocatePaidNumber(tx, recordId, year),
  );
  return { number, value: formatPaid(year, number) };
}
