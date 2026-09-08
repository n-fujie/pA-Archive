"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { checkApiRole } from "@/lib/auth/guards";
import { parseRecordSlug } from "@/lib/identifiers/paid";
import {
  assignReviewer,
  publishReviewAsRecord,
  setPeerReviewStatus,
} from "@/lib/reviews/service";
import { addRelationship } from "@/lib/records/relationships";
import { RecordServiceError } from "@/lib/records/service";
import type { FormState } from "@/app/submit/actions";

async function ip() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function recordIdFromSlug(slug: string): Promise<string | null> {
  const num = parseRecordSlug(slug);
  if (num === null) return null;
  const r = await prisma.record.findUnique({ where: { paidNumber: num }, select: { id: true } });
  return r?.id ?? null;
}

export async function assignReviewerAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await checkApiRole("EDITOR");
  if (!gate.ok) return { error: gate.error };
  const recordId = await recordIdFromSlug(slug);
  if (!recordId) return { error: "Record not found" };
  try {
    await assignReviewer(
      recordId,
      String(formData.get("reviewerId") ?? ""),
      (formData.get("dueAt") as string) || null,
      gate.user.id,
      await ip(),
    );
    revalidatePath(`/editor/records/${slug}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof RecordServiceError) return { error: err.message };
    throw err;
  }
}

export async function setStatusAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await checkApiRole("EDITOR");
  if (!gate.ok) return { error: gate.error };
  const recordId = await recordIdFromSlug(slug);
  if (!recordId) return { error: "Record not found" };
  try {
    await setPeerReviewStatus(recordId, String(formData.get("status") ?? ""), gate.user.id, await ip());
    revalidatePath(`/editor/records/${slug}`);
    revalidatePath(`/records/${slug}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof RecordServiceError) return { error: err.message };
    throw err;
  }
}

export async function promoteReviewAction(reviewId: string): Promise<FormState> {
  const gate = await checkApiRole("EDITOR");
  if (!gate.ok) return { error: gate.error };
  try {
    const res = await publishReviewAsRecord(reviewId, gate.user.id, await ip());
    revalidatePath(`/records/${res.slug}`);
    return { ok: true, warnings: [`Published as record ${res.slug}.`] };
  } catch (err) {
    if (err instanceof RecordServiceError) return { error: err.message };
    throw err;
  }
}

export async function addRelationshipAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await checkApiRole("EDITOR");
  if (!gate.ok) return { error: gate.error };
  const recordId = await recordIdFromSlug(slug);
  if (!recordId) return { error: "Record not found" };
  try {
    await addRelationship(
      recordId,
      {
        targetRecordId: (formData.get("targetRecordId") as string) || "",
        targetIdentifier: (formData.get("targetIdentifier") as string) || "",
        relationType: formData.get("relationType") as string,
        note: (formData.get("note") as string) || "",
      },
      gate.user.id,
    );
    revalidatePath(`/editor/records/${slug}`);
    revalidatePath(`/records/${slug}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof RecordServiceError) return { error: err.message };
    throw err;
  }
}
