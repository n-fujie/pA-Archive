"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageRecord } from "@/lib/auth/guards";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import {
  addNotice,
  createDraft,
  createNewVersion,
  publishRecord,
  unpublishRecord,
  updateDraftMetadata,
  RecordServiceError,
} from "@/lib/records/service";
import { noticeSchema } from "@/lib/validation/schemas";
import { actionRateLimit } from "@/lib/rate-limit-action";
import { RATE_LIMITS } from "@/lib/rate-limit";

export interface FormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  warnings?: string[];
}

async function ip(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

function parseMetadata(formData: FormData) {
  const authors = JSON.parse((formData.get("authorsJson") as string) || "[]");
  const relatedIdentifiers = JSON.parse((formData.get("relatedJson") as string) || "[]");
  const funding = JSON.parse((formData.get("fundingJson") as string) || "[]");
  const keywords = ((formData.get("keywords") as string) || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return {
    title: (formData.get("title") as string) ?? "",
    subtitle: (formData.get("subtitle") as string) ?? "",
    abstract: (formData.get("abstract") as string) ?? "",
    keywords,
    language: (formData.get("language") as string) || "en",
    publicationType: (formData.get("publicationType") as string) || "OTHER",
    category: (formData.get("category") as string) || "other",
    licenseCode: (formData.get("licenseCode") as string) || "",
    publicationDate: (formData.get("publicationDate") as string) || "",
    references: (formData.get("references") as string) || "",
    relatedIdentifiers,
    funding,
    conflictOfInterest: (formData.get("conflictOfInterest") as string) || "",
    ethicsStatement: (formData.get("ethicsStatement") as string) || "",
    versionLabel: (formData.get("versionLabel") as string) || "",
    authors,
  };
}

export async function createDraftAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/submit");

  const limited = await actionRateLimit(RATE_LIMITS.recordCreate, user.id);
  if (limited) return { error: limited };

  try {
    const res = await createDraft(user.id, parseMetadata(formData), await ip());
    revalidatePath("/dashboard");
    redirect(`/dashboard/records/${res.slug}/edit`);
  } catch (err) {
    if (err instanceof RecordServiceError) {
      return {
        error: err.message,
        fieldErrors: (err.details as { fieldErrors?: Record<string, string[]> })?.fieldErrors,
      };
    }
    throw err;
  }
}

async function resolveManageable(slug: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=/dashboard`);
  const num = parseRecordSlug(slug);
  if (num === null) return { error: "Invalid record" as const };
  const record = await prisma.record.findUnique({
    where: { paidNumber: num },
    select: { id: true, submitterId: true },
  });
  if (!record) return { error: "Record not found" as const };
  if (!canManageRecord(user, record)) return { error: "Not authorized" as const };
  const limited = await actionRateLimit(RATE_LIMITS.mutation, user.id);
  if (limited) return { error: limited };
  return { user, record, num };
}

export async function saveDraftAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const r = await resolveManageable(slug);
  if ("error" in r) return { error: r.error };
  try {
    await updateDraftMetadata(r.record.id, parseMetadata(formData), r.user.id, await ip());
    revalidatePath(`/dashboard/records/${slug}/edit`);
    return { ok: true };
  } catch (err) {
    if (err instanceof RecordServiceError) {
      return {
        error: err.message,
        fieldErrors: (err.details as { fieldErrors?: Record<string, string[]> })?.fieldErrors,
      };
    }
    throw err;
  }
}

export async function publishAction(slug: string, _prev: FormState): Promise<FormState> {
  const r = await resolveManageable(slug);
  if ("error" in r) return { error: r.error };
  try {
    const result = await publishRecord(r.record.id, r.user.id, await ip());
    revalidatePath(`/records/${slug}`);
    revalidatePath(`/dashboard`);
    return { ok: true, warnings: result.warnings };
  } catch (err) {
    if (err instanceof RecordServiceError) {
      return {
        error: err.message,
        fieldErrors: (err.details as { fieldErrors?: Record<string, string[]> })?.fieldErrors,
      };
    }
    throw err;
  }
}

export async function newVersionAction(slug: string): Promise<FormState> {
  const r = await resolveManageable(slug);
  if ("error" in r) return { error: r.error };
  try {
    await createNewVersion(r.record.id, r.user.id, await ip());
    revalidatePath(`/dashboard/records/${slug}`);
    redirect(`/dashboard/records/${slug}/edit`);
  } catch (err) {
    if (err instanceof RecordServiceError) return { error: err.message };
    throw err;
  }
}

export async function noticeAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const r = await resolveManageable(slug);
  if ("error" in r) return { error: r.error };
  const parsed = noticeSchema.safeParse({
    type: formData.get("type"),
    reason: formData.get("reason"),
    detailsUrl: formData.get("detailsUrl") ?? "",
  });
  if (!parsed.success) {
    return { error: "Invalid notice", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await addNotice(
      r.record.id,
      parsed.data.type,
      parsed.data.reason,
      parsed.data.detailsUrl || null,
      r.user.id,
      await ip(),
    );
    revalidatePath(`/records/${slug}`);
    revalidatePath(`/dashboard/records/${slug}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof RecordServiceError) return { error: err.message };
    throw err;
  }
}

export async function unpublishAction(slug: string): Promise<FormState> {
  const r = await resolveManageable(slug);
  if ("error" in r) return { error: r.error };
  await unpublishRecord(r.record.id, r.user.id, await ip());
  revalidatePath(`/records/${slug}`);
  return { ok: true };
}
