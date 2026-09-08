import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  buildStorageKey,
  getStorage,
  sha256,
  validateUpload,
} from "@/lib/storage";
import { logger } from "@/lib/log";
import { RecordServiceError } from "./service";

export interface UploadedFile {
  filename: string;
  contentType: string;
  bytes: Buffer;
  label?: string | null;
  isPrimary?: boolean;
}

async function assertEditableVersion(recordId: string) {
  const record = await prisma.record.findUnique({
    where: { id: recordId },
    include: { currentVersion: true },
  });
  if (!record) throw new RecordServiceError("Record not found", 404);
  const version = record.currentVersion;
  if (!version) throw new RecordServiceError("Record has no version", 409);
  if (version.state !== "DRAFT") {
    throw new RecordServiceError(
      "Files can only be changed on a draft version. Create a new version first.",
      409,
    );
  }
  return { record, version };
}

export async function addFileToRecord(
  recordId: string,
  file: UploadedFile,
  userId: string,
  ip?: string | null,
): Promise<{ fileId: string }> {
  const { record, version } = await assertEditableVersion(recordId);

  const check = validateUpload(file.filename, file.contentType, file.bytes.length);
  if (!check.ok) throw new RecordServiceError(check.reason ?? "File rejected", 422);

  const storage = getStorage();
  const fileId = crypto.randomUUID();
  const key = buildStorageKey(record.id, version.versionNumber, fileId, file.filename);
  const checksum = sha256(file.bytes);

  const put = await storage.put({
    key,
    body: file.bytes,
    contentType: file.contentType || "application/octet-stream",
    filename: file.filename,
  });

  let created;
  try {
    created = await prisma.fileObject.create({
      data: {
        id: fileId,
        recordVersionId: version.id,
        storageProvider: put.provider,
        storageKey: put.key,
        downloadUrl: put.url,
        originalName: file.filename,
        contentType: file.contentType || "application/octet-stream",
        byteSize: file.bytes.length,
        checksumSha256: checksum,
        label: file.label ?? null,
        isPrimary: Boolean(file.isPrimary),
        uploadedById: userId,
      },
    });
  } catch (err) {
    // The DB row could not be created — remove the just-written object so we
    // do not leave an orphan in storage.
    await storage.delete(put.key).catch(() => undefined);
    throw err;
  }

  await writeAudit({
    action: "FILE_UPLOAD",
    actorId: userId,
    targetType: "file",
    targetId: created.id,
    summary: `Uploaded "${file.filename}" (${file.bytes.length} bytes) to v${version.versionNumber}`,
    metadata: { checksum, recordId },
    ip,
  });

  return { fileId: created.id };
}

/**
 * Replace a file: the OLD FileObject row is kept and marked superseded — the
 * bytes are not overwritten — and a new row is created.
 */
export async function replaceFile(
  recordId: string,
  oldFileId: string,
  file: UploadedFile,
  userId: string,
  ip?: string | null,
): Promise<{ fileId: string }> {
  const { record, version } = await assertEditableVersion(recordId);
  const old = await prisma.fileObject.findUnique({ where: { id: oldFileId } });
  if (!old || old.recordVersionId !== version.id) {
    throw new RecordServiceError("Original file not found on this version", 404);
  }
  const check = validateUpload(file.filename, file.contentType, file.bytes.length);
  if (!check.ok) throw new RecordServiceError(check.reason ?? "File rejected", 422);

  const storage = getStorage();
  const fileId = crypto.randomUUID();
  const key = buildStorageKey(record.id, version.versionNumber, fileId, file.filename);
  const checksum = sha256(file.bytes);
  const put = await storage.put({
    key,
    body: file.bytes,
    contentType: file.contentType || "application/octet-stream",
    filename: file.filename,
  });

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const c = await tx.fileObject.create({
        data: {
          id: fileId,
          recordVersionId: version.id,
          storageProvider: put.provider,
          storageKey: put.key,
          downloadUrl: put.url,
          originalName: file.filename,
          contentType: file.contentType || "application/octet-stream",
          byteSize: file.bytes.length,
          checksumSha256: checksum,
          label: old.label,
          isPrimary: old.isPrimary,
          uploadedById: userId,
        },
      });
      await tx.fileObject.update({
        where: { id: old.id },
        data: { supersededById: c.id },
      });
      return c;
    });
  } catch (err) {
    await storage.delete(put.key).catch(() => undefined);
    throw err;
  }

  await writeAudit({
    action: "FILE_REPLACE",
    actorId: userId,
    targetType: "file",
    targetId: created.id,
    summary: `Replaced "${old.originalName}" with "${file.filename}" on v${version.versionNumber}`,
    metadata: { oldFileId: old.id, oldChecksum: old.checksumSha256, newChecksum: checksum },
    ip,
  });

  return { fileId: created.id };
}

export async function deleteFileFromDraft(
  recordId: string,
  fileId: string,
  userId: string,
  ip?: string | null,
): Promise<void> {
  const { version } = await assertEditableVersion(recordId);
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file || file.recordVersionId !== version.id) {
    throw new RecordServiceError("File not found on this version", 404);
  }
  // Only remove storage bytes if no other FileObject row references the key
  // (a new version copies rows but shares keys).
  const sharers = await prisma.fileObject.count({ where: { storageKey: file.storageKey } });
  await prisma.fileObject.delete({ where: { id: fileId } });
  if (sharers <= 1) {
    try {
      await getStorage().delete(file.storageKey);
    } catch (err) {
      logger.error("files.storage_delete_failed", err, { storageKey: file.storageKey });
    }
  }
  await writeAudit({
    action: "FILE_DELETE",
    actorId: userId,
    targetType: "file",
    targetId: fileId,
    summary: `Removed "${file.originalName}" from draft v${version.versionNumber}`,
    ip,
  });
}
