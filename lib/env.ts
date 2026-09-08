/**
 * Centralised, validated environment access.
 * Import from here instead of reading process.env directly.
 */

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    return "";
  }
  return v;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1" || v === "yes";
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  siteUrl: str("NEXT_PUBLIC_SITE_URL", "http://localhost:3000").replace(/\/$/, ""),
  operatorName: str("NEXT_PUBLIC_OPERATOR_NAME", "P/A Institute"),
  serviceName: str("NEXT_PUBLIC_SERVICE_NAME", "P/A Archive"),
  parentDomain: str("NEXT_PUBLIC_PARENT_DOMAIN", "platodesignlab.com"),

  databaseUrl: str("DATABASE_URL"),

  authSecret: str("AUTH_SECRET"),

  storageProvider: (str("STORAGE_PROVIDER", "local") as
    | "local"
    | "s3"
    | "vercel-blob"),
  storageLocalDir: str("STORAGE_LOCAL_DIR", "./storage-data"),
  blobToken: str("BLOB_READ_WRITE_TOKEN"),
  s3: {
    region: str("S3_REGION", "auto"),
    bucket: str("S3_BUCKET"),
    accessKeyId: str("S3_ACCESS_KEY_ID"),
    secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
    endpoint: str("S3_ENDPOINT"),
    publicBaseUrl: str("S3_PUBLIC_BASE_URL"),
  },
  maxUploadBytes: int("MAX_UPLOAD_BYTES", 52_428_800),

  doiProvider: (str("DOI_PROVIDER", "local") as "local" | "crossref" | "datacite"),
  doiPrefix: str("DOI_PREFIX"),
  doiSuffixNamespace: str("DOI_SUFFIX_NAMESPACE", "pa"),
  crossref: {
    username: str("CROSSREF_USERNAME"),
    password: str("CROSSREF_PASSWORD"),
    prefix: str("CROSSREF_PREFIX"),
    depositUrl: str("CROSSREF_DEPOSIT_URL", "https://api.crossref.org/deposits"),
    depositorName: str("CROSSREF_DEPOSITOR_NAME", "P/A Institute"),
    depositorEmail: str("CROSSREF_DEPOSITOR_EMAIL"),
  },
  datacite: {
    username: str("DATACITE_USERNAME"),
    password: str("DATACITE_PASSWORD"),
    prefix: str("DATACITE_PREFIX"),
    apiUrl: str("DATACITE_API_URL", "https://api.datacite.org"),
  },

  allowOpenSignup: bool("ALLOW_OPEN_SIGNUP", true),

  seedAdminPassword: str("SEED_ADMIN_PASSWORD", "password123"),
  seedDefaultPassword: str("SEED_DEFAULT_PASSWORD", "password123"),
  seedSampleRecord: bool("SEED_SAMPLE_RECORD", true),

  isProduction: process.env.NODE_ENV === "production",
};

/**
 * Whether a *formal DOI* provider is fully configured. When false, the system
 * must NEVER present a DOI as registered — only P/A Identifiers are issued.
 */
export function isDoiProviderConfigured(): boolean {
  if (env.doiProvider === "crossref") {
    return Boolean(
      env.crossref.username && env.crossref.password && env.crossref.prefix,
    );
  }
  if (env.doiProvider === "datacite") {
    return Boolean(
      env.datacite.username && env.datacite.password && env.datacite.prefix,
    );
  }
  return false;
}

export function effectiveDoiPrefix(): string {
  if (env.doiProvider === "crossref") return env.crossref.prefix || env.doiPrefix;
  if (env.doiProvider === "datacite") return env.datacite.prefix || env.doiPrefix;
  return "";
}
