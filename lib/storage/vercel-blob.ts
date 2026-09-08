import { env } from "@/lib/env";
import type {
  GetObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from "./types";

/**
 * Vercel Blob driver. Requires BLOB_READ_WRITE_TOKEN (auto-injected on Vercel
 * once a Blob store is linked to the project).
 */
export class VercelBlobStorageDriver implements StorageDriver {
  readonly name = "vercel-blob" as const;
  private urlByKey = new Map<string, string>();

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const { put } = await import("@vercel/blob");
    const res = await put(input.key, Buffer.from(input.body), {
      access: "public",
      contentType: input.contentType,
      token: env.blobToken || undefined,
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
    // the returned URL. If not cached (cold start), fall back to null and let
    // the download route stream via get() using a stored downloadUrl.
    return this.urlByKey.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    const url = this.publicUrl(key);
    if (!url) return;
    const { del } = await import("@vercel/blob");
    await del(url, { token: env.blobToken || undefined });
  }
}
