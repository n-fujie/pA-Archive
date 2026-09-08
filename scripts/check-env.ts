/**
 * Production environment preflight.
 *
 *   NODE_ENV=production npm run check-env
 *
 * Run this with the exact env you plan to deploy (e.g. `vercel env pull` then
 * source it) BEFORE promoting a deployment. It never connects to anything — it
 * only validates that the variables are internally consistent and safe.
 *
 * Exit 0 = ready.  Exit 1 = blocking problem.  Warnings do not fail.
 */

const errors: string[] = [];
const warnings: string[] = [];
const notes: string[] = [];

const isProd =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

function need(name: string, hint = "") {
  if (!process.env[name] || process.env[name] === "") {
    errors.push(`${name} is required${hint ? ` — ${hint}` : ""}`);
  }
}
function forbid(name: string, why: string) {
  if (process.env[name] && process.env[name] !== "" && process.env[name] !== "false") {
    errors.push(`${name} must NOT be set in production — ${why}`);
  }
}
function url(name: string): URL | null {
  const v = process.env[name];
  if (!v) return null;
  try {
    return new URL(v);
  } catch {
    errors.push(`${name} is not a valid URL: ${v}`);
    return null;
  }
}

console.log(`Preflight (NODE_ENV=${process.env.NODE_ENV ?? "unset"}, VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})\n`);

// --- Core -----------------------------------------------------------------
need("AUTH_SECRET", "openssl rand -base64 48");
if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
  errors.push("AUTH_SECRET is shorter than 32 chars — regenerate with `openssl rand -base64 48`");
}
need("DATABASE_URL", "pooled Postgres connection string");

const site = url("APP_URL") ?? url("NEXT_PUBLIC_SITE_URL");
if (!site) {
  errors.push("Set APP_URL (and NEXT_PUBLIC_SITE_URL) to https://archive.platodesignlab.com");
} else {
  if (isProd && site.protocol !== "https:") errors.push(`Canonical origin must be https in production (got ${site.origin})`);
  if (site.hostname.endsWith(".vercel.app")) {
    errors.push("APP_URL / NEXT_PUBLIC_SITE_URL points at a *.vercel.app host — use the custom domain so canonical URLs, sitemap, JSON-LD and citations are correct");
  }
  if (site.pathname !== "/" || site.search) warnings.push("Canonical origin should have no path/query");
}

const authUrl = url("AUTH_URL");
if (isProd && !authUrl) errors.push("AUTH_URL is required in production (e.g. https://archive.platodesignlab.com)");
if (site && authUrl && site.origin !== authUrl.origin) {
  errors.push(`AUTH_URL (${authUrl.origin}) must match the canonical origin (${site.origin})`);
}
if (isProd && process.env.AUTH_TRUST_HOST !== "true") {
  warnings.push("AUTH_TRUST_HOST should be 'true' on Vercel");
}

// --- Storage ------------------------------------------------------------
const storage = process.env.STORAGE_PROVIDER || "local";
if (isProd) {
  if (storage === "local" && process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION !== "true") {
    errors.push("STORAGE_PROVIDER=local is not allowed in production (ephemeral filesystem) — use vercel-blob or s3");
  }
  if (storage === "vercel-blob" && !process.env.BLOB_READ_WRITE_TOKEN) {
    errors.push("STORAGE_PROVIDER=vercel-blob but BLOB_READ_WRITE_TOKEN is missing — link a Blob store to the Vercel project");
  }
  if (storage === "s3") {
    for (const k of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) need(k, "s3 storage");
  }
}
notes.push(`storage: ${storage}`);

// --- DOI --------------------------------------------------------------
const doi = process.env.DOI_PROVIDER || "local";
if (doi === "crossref") {
  for (const k of ["CROSSREF_USERNAME", "CROSSREF_PASSWORD", "CROSSREF_PREFIX"]) need(k, "crossref DOI");
  if (process.env.CROSSREF_PREFIX && !/^10\.\d{4,9}$/.test(process.env.CROSSREF_PREFIX)) {
    errors.push(`CROSSREF_PREFIX '${process.env.CROSSREF_PREFIX}' does not look like a real DOI prefix (10.NNNNN)`);
  }
} else if (doi === "datacite") {
  for (const k of ["DATACITE_USERNAME", "DATACITE_PASSWORD", "DATACITE_PREFIX"]) need(k, "datacite DOI");
  if (process.env.DATACITE_PREFIX && !/^10\.\d{4,9}$/.test(process.env.DATACITE_PREFIX)) {
    errors.push(`DATACITE_PREFIX '${process.env.DATACITE_PREFIX}' does not look like a real DOI prefix (10.NNNNN)`);
  }
} else {
  notes.push("DOI: local (P/A Identifiers only — no formal DOI displayed)");
  if (process.env.DOI_PREFIX) warnings.push("DOI_PREFIX is set but DOI_PROVIDER=local — it will be ignored (and must never be invented)");
}

// --- Production-forbidden vars ---------------------------------------
if (isProd) {
  forbid("SEED_DEMO_USERS", "demo accounts must not exist in production");
  forbid("SEED_DEFAULT_PASSWORD", "no shared demo password in production");
  forbid("SEED_SAMPLE_RECORD", "no sample record in production");
  forbid("ALLOW_LOCAL_STORAGE_IN_PRODUCTION", "Vercel filesystem is ephemeral");
  if (process.env.INITIAL_ADMIN_PASSWORD) {
    warnings.push("INITIAL_ADMIN_PASSWORD is set — fine for the one-time bootstrap, but remove it afterwards");
  }
}

// --- Signup recommendation -----------------------------------------
if (isProd && process.env.ALLOW_OPEN_SIGNUP === "true") {
  notes.push("ALLOW_OPEN_SIGNUP=true — open submitter registration is enabled. For a closed beta, set it to 'false' until you have reviewed rate-limit scaling.");
}
if (isProd && process.env.RATE_LIMIT_ENABLED === "false") {
  warnings.push("RATE_LIMIT_ENABLED=false in production — brute-force protection is off");
}

// --- Report ----------------------------------------------------------
for (const n of notes) console.log(`  note   ${n}`);
for (const w of warnings) console.log(`  WARN   ${w}`);
for (const e of errors) console.log(`  ERROR  ${e}`);

console.log(
  `\n${errors.length} error(s), ${warnings.length} warning(s).` +
    (errors.length === 0 ? "  Preflight OK." : "  Fix the errors before deploying."),
);
process.exit(errors.length === 0 ? 0 : 1);
