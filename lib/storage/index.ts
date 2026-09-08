import { createHash } from "node:crypto";
import { assertStorageSafeForRuntime, env } from "@/lib/env";
import {
  ALLOWED_MIME_PREFIXES,
  ALLOWED_UPLOAD_EXTENSIONS,
  BLOCKED_UPLOAD_EXTENSIONS,
} from "@/lib/constants";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";
import { VercelBlobStorageDriver, assertVercelBlobConfigured } from "./vercel-blob";
import { assertS3Configured } from "./s3";
import type { StorageDriver } from "./types";

export * from "./types";

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  assertStorageSafeForRuntime();
  switch (env.storageProvider) {
    case "s3":
      assertS3Configured();
      driver = new S3StorageDriver();
      break;
    case "vercel-blob":
      assertVercelBlobConfigured();
      driver = new VercelBlobStorageDriver();
      break;
    default:
      driver = new LocalStorageDriver();
  }
  return driver;
}

export function sha256(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(Buffer.from(buf)).digest("hex");
}

export function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return m ? m[1].toLowerCase() : "";
}

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
  extension: string;
}

/**
 * Defence-in-depth upload validation: extension allow-list, explicit
 * executable/script block-list, MIME prefix check, and size limit.
 */
export function validateUpload(
  filename: string,
  contentType: string,
  byteSize: number,
): FileValidationResult {
  const extension = extensionOf(filename);

  if (!filename || /[/\\]/.test(filename) || filename.includes("..")) {
    return { ok: false, reason: "Invalid file name", extension };
  }
  if (byteSize <= 0) {
    return { ok: false, reason: "Empty file", extension };
  }
  if (byteSize > env.maxUploadBytes) {
    return {
      ok: false,
      reason: `File exceeds the ${(env.maxUploadBytes / 1_048_576).toFixed(0)} MiB limit`,
      extension,
    };
  }
  if (!extension) {
    return { ok: false, reason: "File must have an extension", extension };
  }
  if (BLOCKED_UPLOAD_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      reason: `The .${extension} file type is not permitted (executable / script content)`,
      extension,
    };
  }
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      ok: false,
      reason: `The .${extension} file type is not on the allow-list`,
      extension,
    };
  }
  const ct = (contentType || "").toLowerCase();
  const mimeOk =
    ct === "" || ALLOWED_MIME_PREFIXES.some((p) => ct.startsWith(p));
  if (!mimeOk) {
    return { ok: false, reason: `Content type "${contentType}" is not allowed`, extension };
  }
  return { ok: true, extension };
}

/** Build a stable, traversal-safe storage key for a version file. */
export function buildStorageKey(
  recordId: string,
  versionNumber: number,
  fileId: string,
  filename: string,
): string {
  const safeName = filename
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, "_") // collapse ".." so a key can never contain a traversal token
    .replace(/^[_.]+|_+$/g, "")
    .slice(0, 120);
  return `records/${recordId}/v${versionNumber}/${fileId}-${safeName}`;
}
