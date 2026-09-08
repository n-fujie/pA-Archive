import { env } from "@/lib/env";

/**
 * Lightweight fixed-window rate limiter.
 *
 * Storage is in-process: on a single instance it is exact; across serverless
 * instances each instance keeps its own window, so the effective global limit
 * is `limit * instanceCount`. That is acceptable as a first line of defence
 * against brute force / abuse. For strict global limits, back this with a
 * shared store (Upstash Redis / Vercel KV) — see README "Rate limiting".
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "login", "upload". */
  name: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/** Named presets used across the app. */
export const RATE_LIMITS = {
  login: { name: "login", limit: 8, windowSeconds: 300 },
  register: { name: "register", limit: 5, windowSeconds: 3600 },
  upload: { name: "upload", limit: 40, windowSeconds: 600 },
  recordCreate: { name: "record-create", limit: 20, windowSeconds: 3600 },
  search: { name: "search", limit: 120, windowSeconds: 60 },
  publicApi: { name: "public-api", limit: 100, windowSeconds: 60 },
  doiRetry: { name: "doi-retry", limit: 15, windowSeconds: 600 },
  mutation: { name: "mutation", limit: 60, windowSeconds: 60 },
} satisfies Record<string, RateLimitOptions>;

export function rateLimit(identifier: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const limit = opts.limit;

  if (!env.rateLimitEnabled) {
    return { ok: true, remaining: limit, limit, resetAt: now, retryAfterSeconds: 0 };
  }

  sweep(now);
  const key = `${opts.name}:${identifier}`;
  const windowMs = opts.windowSeconds * 1000;
  let bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  const ok = bucket.count <= limit;
  return {
    ok,
    remaining,
    limit,
    resetAt: bucket.resetAt,
    retryAfterSeconds: ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Extract the best-guess client IP from request headers. */
export function clientIpFrom(headers: Headers): string {
  if (env.trustProxyHeaders) {
    const xff = headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const real = headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "unknown";
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
    "RateLimit-Reset": String(Math.ceil((r.resetAt - Date.now()) / 1000)),
  };
  if (!r.ok) h["Retry-After"] = String(r.retryAfterSeconds);
  return h;
}
