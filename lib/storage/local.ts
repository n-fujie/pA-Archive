import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import type {
  GetObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from "./types";

/**
 * Local filesystem driver. Dev / self-hosted only — the Vercel serverless
 * filesystem is ephemeral and read-only outside /tmp, so use s3 or
 * vercel-blob in that environment.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  private root(): string {
    return path.resolve(process.cwd(), env.storageLocalDir);
  }

  private full(key: string): string {
    // Guard against path traversal in the key.
    const clean = key.replace(/^\/+/, "").replace(/\.\.(\/|\\|$)/g, "");
    return path.join(this.root(), clean);
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const dest = this.full(input.key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const buf = Buffer.from(input.body);
    await fs.writeFile(dest, buf);
    return { provider: "local", key: input.key, url: null, size: buf.length };
  }

  async get(key: string): Promise<GetObjectResult> {
    const src = this.full(key);
    const body = await fs.readFile(src);
    return { body, contentType: "application/octet-stream", size: body.length };
  }

  publicUrl(): string | null {
    return null; // served through our own /api/files/:id/download route
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }
}
