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

function firstStr(keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== "") return v;
  }
  return fallback;
}

export const env = {
  /**
   * Canonical public origin. Prefer the server-only APP_URL; fall back to the
   * public NEXT_PUBLIC_SITE_URL. Never derived from VERCEL_URL so that preview
   * deployments do not emit preview hostnames in canonical URLs / metadata.
   */
  siteUrl: firstStr(
    ["APP_URL", "NEXT_PUBLIC_SITE_URL"],
    "http://localhost:3000",
  ).replace(/\/$/, ""),
  operatorName: str("NEXT_PUBLIC_OPERATOR_NAME", "P/A Institute"),
  serviceName: str("NEXT_PUBLIC_SERVICE_NAME", "P/A Archive"),
  parentDomain: str("NEXT_PUBLIC_PARENT_DOMAIN", "platodesignlab.com"),

  databaseUrl: str("DATABASE_URL"),
  // Non-pooled URL used for `prisma migrate` (Neon/Supabase pgbouncer setups).
  directDatabaseUrl: firstStr(["DIRECT_DATABASE_URL", "DIRECT_URL"]),

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

  // --- Seeding (development only) -------------------------------------------
  // Demo users / sample record are created ONLY when SEED_DEMO_USERS=true AND
  // NODE_ENV !== production. There is no default password anywhere.
  seedDemoUsers: bool("SEED_DEMO_USERS", false),
  seedDefaultPassword: str("SEED_DEFAULT_PASSWORD"),
  seedSampleRecord: bool("SEED_SAMPLE_RECORD", false),

  // --- Initial admin bootstrap (scripts/create-admin.ts) ------------------
  initialAdminEmail: str("INITIAL_ADMIN_EMAIL"),
  initialAdminPassword: str("INITIAL_ADMIN_PASSWORD"),
  initialAdminName: str("INITIAL_ADMIN_NAME", "Administrator"),

  // --- Operational -------------------------------------------------------
  // Allow the local filesystem storage driver in production (self-hosting).
  // On Vercel this MUST stay false — the filesystem is ephemeral.
  allowLocalStorageInProduction: bool("ALLOW_LOCAL_STORAGE_IN_PRODUCTION", false),
  rateLimitEnabled: bool("RATE_LIMIT_ENABLED", true),
  trustProxyHeaders: bool("TRUST_PROXY_HEADERS", true),

  isProduction: process.env.NODE_ENV === "production",
  vercelEnv: str("VERCEL_ENV"), // "production" | "preview" | "development" | ""
};

/** Fatal in production: local filesystem storage on an ephemeral host. */
export function assertStorageSafeForRuntime(): void {
  if (
    env.isProduction &&
    env.storageProvider === "local" &&
    !env.allowLocalStorageInProduction
  ) {
    throw new Error(
      "STORAGE_PROVIDER=local is not allowed in production (ephemeral filesystem). " +
        "Set STORAGE_PROVIDER=vercel-blob or s3, or ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true for a self-hosted persistent volume.",
    );
  }
}

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
