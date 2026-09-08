import { assertVercelBlobConfigured } from "@/lib/storage/vercel-blob";
import { assertS3Configured } from "@/lib/storage/s3";

describe("storage provider configuration guards", () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
  });

  it("assertVercelBlobConfigured throws a clear error without a token", () => {
    // env.blobToken is read at module load; in the test env it is empty.
    expect(() => assertVercelBlobConfigured()).toThrow(/Blob store/i);
  });

  it("assertS3Configured throws listing the missing S3_* vars", () => {
    // env.s3.* are read at module load; empty in the test env.
    expect(() => assertS3Configured()).toThrow(/S3_BUCKET/);
    expect(() => assertS3Configured()).toThrow(/S3_ACCESS_KEY_ID/);
  });
});
