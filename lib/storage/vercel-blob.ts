import { env } from "@/lib/env";
import type {
  GetObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from "./types";

const MISSING_TOKEN_MESSAGE =
  "STORAGE_PROVIDER=vercel-blob but no Blob store is linked. " +
  "Create a Blob store in the Vercel dashboard and connect it to this project " +
  "(BLOB_READ_WRITE_TOKEN is then injected automatically), or set the token " +
  "explicitly for local testing.";

/**
 * Vercel Blob driver. Requires BLOB_READ_WRITE_TOKEN (auto-injected on Vercel
 * once a Blob store is linked to the project). No local fallback: if the token
 * is absent, every operation fails loudly with a configuration error.
 */
export class VercelBlobStorageDriver implements StorageDriver {
  readonly name = "vercel-blob" as const;
  private urlByKey = new Map<string, string>();

  private token(): string {
    // `@vercel/blob` also reads process.env.BLOB_READ_WRITE_TOKEN itself, but we
    // check here so the failure is an explicit configuration error, not an
    // opaque SDK error.
    if (!env.blobToken) throw new Error(MISSING_TOKEN_MESSAGE);
    return env.blobToken;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const token = this.token();
    const { put } = await import("@vercel/blob");
    const res = await put(input.key, Buffer.from(input.body), {
      access: "public",
      contentType: input.contentType,
      token,
      addRandomSuffix: false,
    });
    this.urlByKey.set(input.key, res.url);
    return {
      provider: "vercel-blob",
      key: input.key,
      url: res.url,
      size: input.body.byteLength ?? Buffer.from(input.body).length,
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    const url = this.publicUrl(key);
    if (!url) throw new Error(`Blob URL unknown for key ${key}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      body: buf,
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
      size: buf.length,
    };
  }

  publicUrl(key: string): string | null {
    // Blob keys map deterministically to a public URL once uploaded; we cache
    // the returned URL. If not cached (cold start), the download route falls
    // back to the FileObject.downloadUrl persisted at upload time.
    return this.urlByKey.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    const url = this.publicUrl(key);
    if (!url) return;
    const { del } = await import("@vercel/blob");
    await del(url, { token: this.token() });
  }
}

/** Throws when vercel-blob is selected but not configured. */
export function assertVercelBlobConfigured(): void {
  if (!env.blobToken) throw new Error(MISSING_TOKEN_MESSAGE);
}
