import { NextResponse } from "next/server";

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { "Access-Control-Allow-Origin": "*", ...(init?.headers ?? {}) },
  });
}

export function apiError(message: string, status = 400, details?: unknown): NextResponse {
  return json({ error: message, details }, { status });
}

export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

/**
 * Read JSON body defensively.
 */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
