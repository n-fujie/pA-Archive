"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkApiRole } from "@/lib/auth/guards";
import { submitReview } from "@/lib/reviews/service";
import { RecordServiceError } from "@/lib/records/service";
import { actionRateLimit } from "@/lib/rate-limit-action";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { FormState } from "@/app/submit/actions";

async function ip() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function submitReviewAction(
  assignmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await checkApiRole("REVIEWER");
  if (!gate.ok) return { error: gate.error };

  const limited = await actionRateLimit(RATE_LIMITS.mutation, gate.user.id);
  if (limited) return { error: limited };

  try {
    await submitReview(
      assignmentId,
      {
        recommendation: formData.get("recommendation"),
        body: formData.get("body"),
        confidential: formData.get("confidential") ?? "",
        isPublic: formData.get("isPublic") === "on",
      },
      gate.user.id,
      await ip(),
    );
    revalidatePath("/review");
    return { ok: true };
  } catch (err) {
    if (err instanceof RecordServiceError) {
      return { error: err.message, fieldErrors: (err.details as { fieldErrors?: Record<string, string[]> })?.fieldErrors };
    }
    throw err;
  }
}
