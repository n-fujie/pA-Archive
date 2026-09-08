import { env } from "@/lib/env";
import type {
  GetObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from "./types";

/** Throws when s3 is selected but not fully configured. */
export function assertS3Configured(): void {
  const missing: string[] = [];
  if (!env.s3.bucket) missing.push("S3_BUCKET");
  if (!env.s3.accessKeyId) missing.push("S3_ACCESS_KEY_ID");
  if (!env.s3.secretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
  if (missing.length) {
    throw new Error(
      `STORAGE_PROVIDER=s3 but missing: ${missing.join(", ")}. ` +
        "Set the S3_* credentials (and S3_ENDPOINT for non-AWS providers).",
    );
  }
}

/**
 * S3 / S3-compatible driver (AWS S3, Cloudflare R2, MinIO, Backblaze B2...).
 *
 * Requires the optional dependency `@aws-sdk/client-s3`:
 *     npm install @aws-sdk/client-s3
 * plus S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY (+ S3_ENDPOINT for
 * non-AWS providers).
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;

  private async client() {
    let mod: typeof import("@aws-sdk/client-s3");
    try {
      mod = await import("@aws-sdk/client-s3");
    } catch {
      throw new Error(
        "STORAGE_PROVIDER=s3 but @aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3",
      );
    }
    const client = new mod.S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint || undefined,
      forcePathStyle: Boolean(env.s3.endpoint),
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
    return { client, mod };
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const { client, mod } = await this.client();
    await client.send(
      new mod.PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: input.key,
        Body: Buffer.from(input.body),
        ContentType: input.contentType,
      }),
    );
    return {
      provider: "s3",
      key: input.key,
      url: this.publicUrl(input.key),
      size: Buffer.from(input.body).length,
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    const { client, mod } = await this.client();
    const res = await client.send(
      new mod.GetObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    const body = Buffer.from(bytes ?? new Uint8Array());
    return {
      body,
      contentType: res.ContentType ?? "application/octet-stream",
      size: body.length,
    };
  }

  publicUrl(key: string): string | null {
    if (env.s3.publicBaseUrl) {
      return `${env.s3.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }
    return null;
  }

  async delete(key: string): Promise<void> {
    const { client, mod } = await this.client();
    await client.send(
      new mod.DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    );
  }
}
