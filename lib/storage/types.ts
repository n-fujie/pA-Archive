export interface PutObjectInput {
  key: string; // logical path, e.g. "records/<id>/v1/<uuid>-manuscript.pdf"
  body: Buffer | Uint8Array;
  contentType: string;
  filename: string;
}

export interface PutObjectResult {
  provider: "local" | "s3" | "vercel-blob";
  key: string;
  /** Absolute URL when the provider serves objects directly; otherwise null. */
  url: string | null;
  size: number;
}

export interface GetObjectResult {
  body: Buffer;
  contentType: string;
  size: number;
}

export interface StorageDriver {
  readonly name: "local" | "s3" | "vercel-blob";
  put(input: PutObjectInput): Promise<PutObjectResult>;
  /** Fetch bytes for streaming through our own download route. */
  get(key: string): Promise<GetObjectResult>;
  /** Provider-native URL if any (blob/s3+cdn). Used for redirect-style downloads. */
  publicUrl(key: string): string | null;
  delete(key: string): Promise<void>;
}
