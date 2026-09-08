/**
 * Return `candidate` only if it is a safe same-origin relative path.
 * Anything absolute, protocol-relative, or containing a backslash / control
 * character / whitespace falls back to `fallback`. Prevents open-redirect via
 * ?callbackUrl and similar parameters.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!candidate) return fallback;
  const value = candidate.trim();

  // Must be a rooted path, not protocol-relative and not a Windows-style path.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes(String.fromCharCode(92))) return fallback;
  // Reject ASCII control characters (incl. DEL) and any whitespace.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (/\s/.test(value)) return fallback;

  let normalised: string;
  try {
    const url = new URL(value, "https://placeholder.invalid");
    if (url.origin !== "https://placeholder.invalid") return fallback;
    normalised = url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }

  // Never bounce back into the auth pages.
  if (/^\/(login|register)(\/|$|\?|#)/.test(normalised)) return fallback;
  return normalised;
}
