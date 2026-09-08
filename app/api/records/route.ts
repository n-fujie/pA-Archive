import type { NextRequest } from "next/server";
import { searchRecords } from "@/lib/records/search";
import { searchQuerySchema } from "@/lib/validation/schemas";
import { createDraft } from "@/lib/records/service";
import { RecordServiceError } from "@/lib/records/service";
import { checkApiRole } from "@/lib/auth/guards";
import { apiError, clientIp, json, readJson } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET /api/records  — PUBLIC. Lists published records with search + filters.
 * Query params: q, year, type, language, category, peerReviewed, author,
 * keyword, page, sort.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiError("Invalid query", 422, parsed.error.flatten());

  const result = await searchRecords(parsed.data);
  return json({
    data: result.hits.map((h) => ({
      id: h.slug,
      title: h.title,
      subtitle: h.subtitle,
      authors: h.authors,
      year: h.year,
      publicationType: h.publicationType,
      category: h.category,
      language: h.language,
      identifier: h.identifier,
      doi: h.doi, // null unless genuinely registered
      peerReviewed: h.isPeerReviewed,
      status: h.status,
      landingPage: `${process.env.NEXT_PUBLIC_SITE_URL}/records/${h.slug}`,
      metadataUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/records/${h.slug}/metadata`,
    })),
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    },
    facets: result.facets,
  });
}

/**
 * POST /api/records  — AUTHENTICATED (submitter+). Creates a draft record.
 * Body: draft metadata JSON (see lib/validation/schemas.ts draftMetadataSchema).
 */
export async function POST(req: NextRequest) {
  const gate = await checkApiRole("SUBMITTER");
  if (!gate.ok) return apiError(gate.error, gate.status);

  const body = await readJson(req);
  if (!body) return apiError("JSON body required", 400);

  try {
    const res = await createDraft(gate.user.id, body, clientIp(req));
    return json(
      {
        id: res.slug,
        recordId: res.recordId,
        status: "DRAFT",
        landingPage: `${process.env.NEXT_PUBLIC_SITE_URL}/records/${res.slug}`,
        note: "Draft created. Upload files, then POST /api/records/:id/publish.",
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof RecordServiceError) return apiError(err.message, err.status, err.details);
    console.error(err);
    return apiError("Internal error", 500);
  }
}
