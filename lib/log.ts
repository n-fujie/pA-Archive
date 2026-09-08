/**
 * Minimal structured logger with secret redaction.
 *
 * - Writes single-line JSON to stdout/stderr (picked up by Vercel / any log drain).
 * - Redacts obvious secret-bearing keys.
 * - Never logs full stack traces at "info"; "error" includes message + name only
 *   unless DEBUG_ERRORS=true.
 */

const REDACT_KEYS =
  /pass(word)?|secret|token|authorization|cookie|credential|api[_-]?key|bearer/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production" || process.env.DEBUG_LOG === "true") emit("debug", m, c);
  },
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, err?: unknown, c?: Record<string, unknown>) => {
    const e =
      err instanceof Error
        ? {
            errorName: err.name,
            errorMessage: err.message,
            ...(process.env.DEBUG_ERRORS === "true" ? { stack: err.stack } : {}),
          }
        : err != null
          ? { error: String(err) }
          : {};
    emit("error", m, { ...c, ...e });
  },
};

/** A short opaque id to correlate a client-visible error with server logs. */
export function newRequestId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}
