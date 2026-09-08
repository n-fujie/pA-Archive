"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/audit";
import { actionRateLimit } from "@/lib/rate-limit-action";
import { RATE_LIMITS } from "@/lib/rate-limit";

export interface RegisterState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  if (!env.allowOpenSignup) {
    return { error: "Open registration is disabled. Contact an administrator." };
  }

  const limited = await actionRateLimit(RATE_LIMITS.register);
  if (limited) return { error: limited };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    orcid: formData.get("orcid") ?? "",
    affiliation: formData.get("affiliation") ?? "",
  });
  if (!parsed.success) {
    return { error: "Please correct the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { name, email, password, orcid, affiliation } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "SUBMITTER",
      orcid: orcid && orcid !== "" ? orcid : null,
      affiliation: affiliation || null,
    },
  });
  await writeAudit({
    action: "USER_REGISTER",
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    summary: `New submitter registered: ${email}`,
  });

  redirect("/login?registered=1");
}
