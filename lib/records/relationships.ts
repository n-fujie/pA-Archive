import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { relationshipSchema, RELATION_TYPE_VALUES } from "@/lib/validation/schemas";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import { RecordServiceError } from "./service";

export async function addRelationship(
  sourceRecordId: string,
  raw: unknown,
  userId: string,
): Promise<void> {
  const parsed = relationshipSchema.safeParse(raw);
  if (!parsed.success) throw new RecordServiceError("Invalid relationship", 422, parsed.error.flatten());
  const { targetRecordId, targetIdentifier, relationType, note } = parsed.data;

  if (!targetRecordId && !targetIdentifier) {
    throw new RecordServiceError("Provide a target record or an external identifier", 422);
  }

  let resolvedTargetId: string | null = null;
  if (targetRecordId) {
    // Accept either a cuid or a /records slug number.
    const num = parseRecordSlug(targetRecordId);
    const target = num
      ? await prisma.record.findUnique({ where: { paidNumber: num }, select: { id: true } })
      : await prisma.record.findUnique({ where: { id: targetRecordId }, select: { id: true } });
    if (!target) throw new RecordServiceError("Target record not found", 404);
    resolvedTargetId = target.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.relationship.create({
      data: {
        sourceRecordId,
        targetRecordId: resolvedTargetId,
        targetIdentifier: targetIdentifier || null,
        relationType: relationType as (typeof RELATION_TYPE_VALUES)[number],
        note: note || null,
        createdById: userId,
      },
    });
    await writeAudit(
      {
        action: "METADATA_UPDATE",
        actorId: userId,
        targetType: "record",
        targetId: sourceRecordId,
        summary: `Relationship added: ${relationType} -> ${targetIdentifier || resolvedTargetId}`,
      },
      tx,
    );
  });
}
