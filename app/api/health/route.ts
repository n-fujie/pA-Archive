import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — minimal liveness/readiness probe.
 * Public, but intentionally reveals nothing beyond up/down per subsystem.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error" | "skipped"> = {
    app: "ok",
    database: "error",
    storage: "skipped",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Storage: only a cheap driver-construction check (no network round-trip).
  try {
    getStorage();
    checks.storage = "ok";
  } catch {
    checks.storage = "error";
  }

  const healthy = checks.database === "ok" && checks.storage !== "error";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      time: new Date().toISOString(),
      // deliberately no version, commit, or dependency details
      env: env.vercelEnv || (env.isProduction ? "production" : "development"),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
