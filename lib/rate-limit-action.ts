// Importing next/headers makes this module server-only (build-time enforced).
import { headers } from "next/headers";
import {
  clientIpFrom,
  rateLimit,
  type RateLimitOptions,
} from "@/lib/rate-limit";

/**
 * Rate-limit a Server Action by client IP (+ optional key such as a user id).
 * Returns an error message string when the limit is exceeded, else null.
 */
export async function actionRateLimit(
  preset: RateLimitOptions,
  extraKey = "",
): Promise<string | null> {
  const h = await headers();
  const ip = clientIpFrom(h as unknown as Headers);
  const r = rateLimit(`${ip}${extraKey ? `:${extraKey}` : ""}`, preset);
  if (!r.ok) {
    return `Too many attempts. Please wait ${r.retryAfterSeconds}s and try again.`;
  }
  return null;
}
