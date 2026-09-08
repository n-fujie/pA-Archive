import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  RATE_LIMITS,
  clientIpFrom,
  rateLimit,
  rateLimitHeaders,
  type RateLimitOptions,
} from "@/lib/rate-limit";
import { logger, newRequestId } from "@/lib/log";

/** JSON response WITHOUT CORS — for authenticated / session-scoped endpoints. */
export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** JSON response WITH permissive CORS — for genuinely public read endpoints. */
export function jsonPublic(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      ...(init?.headers ?? {}),
    },
  });
}

export function apiError(message: string, status = 400, details?: unknown): NextResponse {
  return json({ error: message, details }, { status });
}

/**
 * Client-safe 500: logs the real error with a request id, returns only the id.
 */
export function apiServerError(err: unknown, where: string): NextResponse {
  const requestId = newRequestId();
  logger.error(`api.error ${where}`, err, { requestId });
  return json(
    { error: "Internal server error", requestId },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}

export function clientIp(req: Request): string | null {
  const ip = clientIpFrom(req.headers);
  return ip === "unknown" ? null : ip;
}

/**
 * Reject cross-site state-changing requests (defence-in-depth on top of the
 * SameSite=Lax session cookie). Allows same-origin and server-to-server
 * requests that carry no Origin header.
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // non-browser client (curl, server, native app)
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return apiError("Bad origin", 403);
  }
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(env.siteUrl).host);
  } catch {
    /* ignore */
  }
  const reqHost = req.headers.get("host");
  if (reqHost) allowed.add(reqHost);
  if (!allowed.has(host)) {
    logger.warn("api.csrf_block", { origin, reqHost });
    return apiError("Cross-origin request refused", 403);
  }
  return null;
}

/**
 * Apply a rate limit to a request. Returns a 429 response when exceeded,
 * otherwise null (and you should proceed).
 */
export function enforceRateLimit(
  req: Request,
  preset: RateLimitOptions,
  extraKey = "",
): NextResponse | null {
  const ip = clientIpFrom(req.headers);
  const result = rateLimit(`${ip}${extraKey ? `:${extraKey}` : ""}`, preset);
  if (!result.ok) {
    return json(
      { error: "Too many requests. Please slow down.", retryAfterSeconds: result.retryAfterSeconds },
      { status: 429, headers: rateLimitHeaders(result) },
    );
  }
  return null;
}

export { RATE_LIMITS };

/** Read JSON body defensively. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
